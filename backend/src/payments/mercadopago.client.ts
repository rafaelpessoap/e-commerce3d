import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import * as crypto from 'crypto';

@Injectable()
export class MercadoPagoClient {
  private readonly logger = new Logger(MercadoPagoClient.name);
  private readonly paymentApi: InstanceType<typeof Payment>;
  private readonly webhookSecret: string;

  constructor(private readonly configService: ConfigService) {
    const accessToken = this.configService.get<string>('MERCADOPAGO_ACCESS_TOKEN') ?? '';
    const config = new MercadoPagoConfig({ accessToken });
    this.paymentApi = new Payment(config);
    this.webhookSecret = this.configService.get<string>('MERCADOPAGO_WEBHOOK_SECRET') ?? '';
  }

  async createPixPayment(params: {
    amount: number;
    description: string;
    externalReference: string;
    payerEmail: string;
    payerCpf: string;
    payerFirstName: string;
  }) {
    try {
      const result = await this.paymentApi.create({
        body: {
          transaction_amount: params.amount,
          payment_method_id: 'pix',
          description: params.description,
          external_reference: params.externalReference,
          payer: {
            email: params.payerEmail,
            first_name: params.payerFirstName,
            identification: { type: 'CPF', number: params.payerCpf },
          },
        },
      });

      const txData = result.point_of_interaction?.transaction_data;

      return {
        id: result.id!,
        qrCode: txData?.qr_code ?? '',
        qrCodeBase64: txData?.qr_code_base64 ?? '',
        ticketUrl: txData?.ticket_url ?? '',
        expiresAt: result.date_of_expiration ?? '',
      };
    } catch (err) {
      this.logger.error(`PIX payment error: ${err}`);
      throw new BadRequestException('Erro ao criar pagamento PIX');
    }
  }

  async createCreditCardPayment(params: {
    amount: number;
    token: string;
    installments: number;
    paymentMethodId: string;
    description: string;
    externalReference: string;
    payerEmail: string;
    payerCpf: string;
  }) {
    try {
      const result = await this.paymentApi.create({
        body: {
          transaction_amount: params.amount,
          token: params.token,
          installments: params.installments,
          payment_method_id: params.paymentMethodId,
          description: params.description,
          external_reference: params.externalReference,
          payer: {
            email: params.payerEmail,
            identification: { type: 'CPF', number: params.payerCpf },
          },
        },
      });

      return {
        id: result.id!,
        status: result.status ?? 'unknown',
        statusDetail: result.status_detail ?? '',
        cardLastFour: result.card?.last_four_digits ?? '',
      };
    } catch (err) {
      this.logger.error(`Credit card payment error: ${err}`);
      throw new BadRequestException('Erro ao processar pagamento com cartão');
    }
  }

  async createBoletoPayment(params: {
    amount: number;
    description: string;
    externalReference: string;
    payerEmail: string;
    payerCpf: string;
    payerFirstName: string;
    payerLastName: string;
  }) {
    try {
      const result = await this.paymentApi.create({
        body: {
          transaction_amount: params.amount,
          payment_method_id: 'bolbradesco',
          description: params.description,
          external_reference: params.externalReference,
          payer: {
            email: params.payerEmail,
            first_name: params.payerFirstName,
            last_name: params.payerLastName,
            identification: { type: 'CPF', number: params.payerCpf },
          },
        },
      });

      return {
        id: result.id!,
        boletoUrl: result.transaction_details?.external_resource_url ?? '',
        barcode: (result as any).barcode?.content ?? '',
        expiresAt: result.date_of_expiration ?? '',
      };
    } catch (err) {
      this.logger.error(`Boleto payment error: ${err}`);
      throw new BadRequestException('Erro ao gerar boleto');
    }
  }

  async getPayment(paymentId: string) {
    try {
      return await this.paymentApi.get({ id: paymentId });
    } catch (err) {
      this.logger.error(`Get payment error: ${err}`);
      throw new BadRequestException('Erro ao consultar pagamento no Mercado Pago');
    }
  }

  verifyWebhookSignature(params: {
    xSignature: string;
    xRequestId: string;
    dataId: string;
  }): boolean {
    try {
      if (!params.xSignature) return false;

      const parts: Record<string, string> = {};
      for (const part of params.xSignature.split(',')) {
        const [key, ...valueParts] = part.split('=');
        if (key && valueParts.length) {
          parts[key.trim()] = valueParts.join('=');
        }
      }

      const ts = parts['ts'];
      const v1 = parts['v1'];
      if (!ts || !v1) return false;

      const manifest = `id:${params.dataId};request-id:${params.xRequestId};ts:${ts};`;
      const hmac = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(manifest)
        .digest('hex');

      return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(v1));
    } catch {
      return false;
    }
  }
}
