import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { MercadoPagoClient } from './mercadopago.client';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, MercadoPagoClient],
  exports: [PaymentsService],
})
export class PaymentsModule {}
