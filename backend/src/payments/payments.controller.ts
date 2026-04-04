import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  Query,
  Req,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';
import { MercadoPagoClient } from './mercadopago.client';
import { CheckoutLogService } from './checkout-log.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('api/v1/payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly mpClient: MercadoPagoClient,
    private readonly checkoutLog: CheckoutLogService,
  ) {}

  @Post('create')
  async createPayment(@Body() dto: CreatePaymentDto, @Req() req: Request) {
    const start = Date.now();
    const userId = (req as any).user?.id;
    const ip = req.ip || (req.headers['x-forwarded-for'] as string);
    const userAgent = req.headers['user-agent'];

    try {
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

      await this.checkoutLog.log({
        step: 'create_payment',
        status: 'success',
        orderId: dto.orderId,
        userId,
        method: dto.method,
        request: dto,
        response: {
          paymentId: result.id,
          status: result.status,
          externalId: result.externalId,
        },
        duration: Date.now() - start,
        ip,
        userAgent,
      });

      return { data: result };
    } catch (err) {
      await this.checkoutLog.log({
        step: 'create_payment',
        status: 'error',
        orderId: dto.orderId,
        userId,
        method: dto.method,
        request: dto,
        error: err,
        duration: Date.now() - start,
        ip,
        userAgent,
      });
      throw err;
    }
  }

  @Public()
  @Post('webhook/mercadopago')
  async mpWebhook(
    @Headers('x-signature') xSignature: string,
    @Headers('x-request-id') xRequestId: string,
    @Query('data.id') dataIdQuery: string,
    @Body() body: { data?: { id?: string }; action?: string; type?: string },
  ) {
    // data.id: query param para HMAC (doc MP), body para processamento
    const dataIdFromQuery = dataIdQuery ?? '';
    const dataIdFromBody = body.data?.id ? String(body.data.id) : '';
    const dataId = dataIdFromQuery || dataIdFromBody;

    if (xSignature) {
      // Tentar verificar com query param primeiro, depois com body
      const isValidQuery =
        dataIdFromQuery &&
        this.mpClient.verifyWebhookSignature({
          xSignature,
          xRequestId: xRequestId ?? '',
          dataId: dataIdFromQuery,
        });

      const isValidBody =
        !isValidQuery &&
        dataIdFromBody &&
        this.mpClient.verifyWebhookSignature({
          xSignature,
          xRequestId: xRequestId ?? '',
          dataId: dataIdFromBody,
        });

      if (!isValidQuery && !isValidBody) {
        this.logger.warn(
          `Webhook assinatura invalida | dataId=${dataId} | sig=${xSignature}`,
        );
        throw new UnauthorizedException('Assinatura inválida');
      }
    }

    // Processar notificação de pagamento
    if (body.action?.startsWith('payment.') && dataId) {
      const start = Date.now();
      try {
        await this.paymentsService.processWebhook(dataId);
        await this.checkoutLog.log({
          step: 'payment_webhook',
          status: 'success',
          request: { action: body.action, dataId },
          metadata: { mpPaymentId: dataId, xRequestId },
          duration: Date.now() - start,
        });
      } catch (err) {
        await this.checkoutLog.log({
          step: 'payment_webhook',
          status: 'error',
          request: { action: body.action, dataId },
          error: err,
          metadata: { mpPaymentId: dataId },
          duration: Date.now() - start,
        });
        throw err;
      }
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

  @Roles('ADMIN')
  @Get(':orderId/logs')
  async getCheckoutLogs(@Param('orderId') orderId: string) {
    return { data: await this.checkoutLog.findByOrder(orderId) };
  }
}
