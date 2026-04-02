import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('api/v1/payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create')
  async createPayment(@Body() dto: { orderId: string; method: string }) {
    return {
      data: await this.paymentsService.createPayment(dto.orderId, dto.method),
    };
  }

  @Public()
  @Post('webhook')
  async webhook(@Body() body: { data: { id: string }; action: string }) {
    // Em produção: verificar assinatura x-signature do Mercado Pago
    if (body.action?.startsWith('payment.')) {
      await this.paymentsService.processWebhook({
        externalId: body.data.id,
        status: body.action.replace('payment.', ''),
      });
    }
    return { received: true };
  }

  @Roles('ADMIN')
  @Get(':orderId')
  async findByOrder(@Param('orderId') orderId: string) {
    return { data: await this.paymentsService.findByOrderId(orderId) };
  }
}
