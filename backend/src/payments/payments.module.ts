import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { MercadoPagoClient } from './mercadopago.client';
import { CheckoutLogService } from './checkout-log.service';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, MercadoPagoClient, CheckoutLogService],
  exports: [PaymentsService, CheckoutLogService],
})
export class PaymentsModule {}
