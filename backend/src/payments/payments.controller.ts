import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { MercadoPagoClient } from './mercadopago.client';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('api/v1/payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly mpClient: MercadoPagoClient,
  ) {}

  @Post('create')
  async createPayment(@Body() dto: CreatePaymentDto) {
    const result = await this.paymentsService.createPayment(
      dto.orderId,
      dto.method,
      {
        cardToken: dto.cardToken,
        installments: dto.installments,
        paymentMethodId: dto.paymentMethodId,
        payerEmail: dto.payerEmail,
        payerCpf: dto.payerCpf,
        payerName: dto.payerName,
      },
    );
    return { data: result };
  }

  @Public()
  @Post('webhook/mercadopago')
  async mpWebhook(
    @Headers('x-signature') xSignature: string,
    @Headers('x-request-id') xRequestId: string,
    @Body() body: { data?: { id?: string }; action?: string; type?: string },
  ) {
    // Verificar assinatura do Mercado Pago
    const dataId = body.data?.id ? String(body.data.id) : '';
    if (xSignature) {
      const isValid = this.mpClient.verifyWebhookSignature({
        xSignature,
        xRequestId: xRequestId ?? '',
        dataId,
      });

      if (!isValid) {
        this.logger.warn('Webhook com assinatura inválida', {
          xSignature,
          xRequestId,
          dataId,
        });
        throw new UnauthorizedException('Assinatura inválida');
      }
    }

    // Processar notificação de pagamento
    if (body.action?.startsWith('payment.') && dataId) {
      await this.paymentsService.processWebhook(dataId);
    }

    return { received: true };
  }

  // Manter endpoint antigo para compatibilidade (será removido)
  @Public()
  @Post('webhook')
  async webhookLegacy(@Body() body: { data: { id: string }; action: string }) {
    if (body.action?.startsWith('payment.') && body.data?.id) {
      await this.paymentsService.processWebhook(String(body.data.id));
    }
    return { received: true };
  }

  @Public()
  @Get(':orderId/status')
  async getPaymentStatus(@Param('orderId') orderId: string) {
    return { data: await this.paymentsService.getPaymentStatus(orderId) };
  }

  @Roles('ADMIN')
  @Get(':orderId')
  async findByOrder(@Param('orderId') orderId: string) {
    return { data: await this.paymentsService.findByOrderId(orderId) };
  }
}
