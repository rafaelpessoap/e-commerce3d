import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PaymentsModule } from '../payments/payments.module';
import { StockModule } from '../stock/stock.module';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [PaymentsModule, StockModule, PricingModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
