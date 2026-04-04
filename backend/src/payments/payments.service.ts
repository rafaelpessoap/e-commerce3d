import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MercadoPagoClient } from './mercadopago.client';

// Descontos configuráveis por método de pagamento (aplicados sobre SUBTOTAL)
const METHOD_DISCOUNTS: Record<string, number> = {
  pix: 10, // 10%
  boleto: 5, // 5%
  credit_card: 0,
  debit_card: 0,
};

const WEBHOOK_STATUS_MAP: Record<string, string> = {
  approved: 'APPROVED',
  authorized: 'APPROVED',
  pending: 'PENDING',
  in_process: 'PENDING',
  rejected: 'FAILED',
  cancelled: 'CANCELLED',
  refunded: 'CANCELLED',
  charged_back: 'CANCELLED',
};

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private mpClient: MercadoPagoClient,
  ) {}

  calculateMethodDiscount(method: string, amount: number): number {
    const percentage = METHOD_DISCOUNTS[method] ?? 0;
    return Math.round(amount * (percentage / 100) * 100) / 100;
  }

  async createPayment(
    orderId: string,
    method: string,
    extra?: {
      cardToken?: string;
      installments?: number;
      paymentMethodId?: string;
      payerEmail?: string;
      payerCpf?: string;
      payerName?: string;
    },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true },
    });

    if (!order) throw new NotFoundException('Order not found');

    // Desconto sobre SUBTOTAL (não total que inclui frete)
    const discount = this.calculateMethodDiscount(method, order.subtotal);
    const amount = Math.round((order.subtotal - discount + order.shipping) * 100) / 100;

    // Criar registro local PENDING
    const payment = await this.prisma.payment.create({
      data: { orderId, method, amount, discount, status: 'PENDING' },
    });

    const payerEmail = extra?.payerEmail ?? order.user?.email ?? '';
    const payerCpf = extra?.payerCpf ?? (order.user as any)?.cpf ?? '';
    const payerName = extra?.payerName ?? order.user?.name ?? '';

    // Dispatcher por método
    switch (method) {
      case 'pix':
        return this.handlePixPayment(payment, order, payerEmail, payerCpf, payerName);
      case 'boleto':
        return this.handleBoletoPayment(payment, order, payerEmail, payerCpf, payerName);
      case 'credit_card':
        return this.handleCreditCardPayment(payment, order, extra);
      default:
        throw new BadRequestException(`Método de pagamento não suportado: ${method}`);
    }
  }

  private async handlePixPayment(
    payment: any,
    order: any,
    payerEmail: string,
    payerCpf: string,
    payerName: string,
  ) {
    const mpResult = await this.mpClient.createPixPayment({
      amount: payment.amount,
      description: `Pedido ${order.number ?? order.id}`,
      externalReference: order.id,
      payerEmail,
      payerCpf,
      payerFirstName: payerName.split(' ')[0] ?? payerName,
    });

    return this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        externalId: String(mpResult.id),
        pixQrCode: mpResult.qrCodeBase64,
        pixCopiaECola: mpResult.qrCode,
        expiresAt: mpResult.expiresAt ? new Date(mpResult.expiresAt) : null,
      },
    });
  }

  private async handleBoletoPayment(
    payment: any,
    order: any,
    payerEmail: string,
    payerCpf: string,
    payerName: string,
  ) {
    const nameParts = payerName.split(' ');
    const firstName = nameParts[0] ?? payerName;
    const lastName = nameParts.slice(1).join(' ') || firstName;

    const mpResult = await this.mpClient.createBoletoPayment({
      amount: payment.amount,
      description: `Pedido ${order.number ?? order.id}`,
      externalReference: order.id,
      payerEmail,
      payerCpf,
      payerFirstName: firstName,
      payerLastName: lastName,
    });

    return this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        externalId: String(mpResult.id),
        boletoUrl: mpResult.boletoUrl,
        boletoBarcode: mpResult.barcode,
        expiresAt: mpResult.expiresAt ? new Date(mpResult.expiresAt) : null,
      },
    });
  }

  private async handleCreditCardPayment(
    payment: any,
    order: any,
    extra?: {
      cardToken?: string;
      installments?: number;
      paymentMethodId?: string;
      payerEmail?: string;
      payerCpf?: string;
      payerName?: string;
    },
  ) {
    if (!extra?.cardToken) {
      throw new BadRequestException('cardToken é obrigatório para pagamento com cartão');
    }

    const mpResult = await this.mpClient.createCreditCardPayment({
      amount: payment.amount,
      token: extra.cardToken,
      installments: extra.installments ?? 1,
      paymentMethodId: extra.paymentMethodId ?? 'visa',
      description: `Pedido ${order.number ?? order.id}`,
      externalReference: order.id,
      payerEmail: extra.payerEmail ?? '',
      payerCpf: extra.payerCpf ?? '',
    });

    const newStatus = WEBHOOK_STATUS_MAP[mpResult.status] ?? 'PENDING';

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        externalId: String(mpResult.id),
        status: newStatus as any,
        cardLastFour: mpResult.cardLastFour,
        installments: extra.installments ?? 1,
        paidAt: newStatus === 'APPROVED' ? new Date() : undefined,
        paidAmount: newStatus === 'APPROVED' ? payment.amount : undefined,
      },
    });

    // Sincronizar status do pedido
    if (newStatus === 'APPROVED' || newStatus === 'FAILED') {
      await this.prisma.order.update({
        where: { id: payment.orderId },
        data: { paymentStatus: newStatus as any },
      });
    }

    return updated;
  }

  /**
   * Processa webhook do Mercado Pago com double-check.
   * Busca pagamento na API do MP para confirmar status (não confia apenas no webhook).
   */
  async processWebhook(mpPaymentId: string) {
    // 1. Double-check: buscar pagamento real na API do MP
    const mpPayment = await this.mpClient.getPayment(mpPaymentId);
    const newStatus = WEBHOOK_STATUS_MAP[mpPayment.status];
    if (!newStatus) return;

    // 2. Encontrar payment local pelo externalId OU external_reference
    const payment = await this.prisma.payment.findFirst({
      where: {
        OR: [
          { externalId: String(mpPayment.id) },
          { orderId: mpPayment.external_reference },
        ],
      },
    });
    if (!payment) return;

    // 3. Idempotência
    if (payment.status === newStatus) return;

    // 4. Verificar que o valor confere (tolerância de R$0.01)
    if (Math.abs(mpPayment.transaction_amount - payment.amount) > 0.01) {
      this.logger.error(
        `Webhook valor divergente: MP=${mpPayment.transaction_amount}, local=${payment.amount}`,
      );
      return;
    }

    // 5. Atualizar payment
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: newStatus as any,
        externalId: String(mpPayment.id),
        paidAt: newStatus === 'APPROVED' ? new Date() : undefined,
        paidAmount: newStatus === 'APPROVED' ? mpPayment.transaction_amount : undefined,
        webhookData: JSON.stringify(mpPayment),
      },
    });

    // 6. Sincronizar status do pedido
    await this.prisma.order.update({
      where: { id: payment.orderId },
      data: { paymentStatus: newStatus as any },
    });
  }

  async findByOrderId(orderId: string) {
    return this.prisma.payment.findFirst({
      where: { orderId },
    });
  }

  async getPaymentStatus(orderId: string) {
    return this.prisma.payment.findFirst({
      where: { orderId },
      select: {
        id: true,
        orderId: true,
        status: true,
        method: true,
        amount: true,
        discount: true,
        pixQrCode: true,
        pixCopiaECola: true,
        boletoUrl: true,
        boletoBarcode: true,
        expiresAt: true,
        cardLastFour: true,
        installments: true,
        paidAt: true,
      },
    });
  }
}
