import { Module } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { ScalesModule } from '../scales/scales.module';
import { CouponsModule } from '../coupons/coupons.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [ScalesModule, CouponsModule, PaymentsModule],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
