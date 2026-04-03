import { Module } from '@nestjs/common';
import { ShippingController } from './shipping.controller';
import { ShippingService } from './shipping.service';
import { MelhorEnvioService } from './melhor-envio.service';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [ProductsModule],
  controllers: [ShippingController],
  providers: [ShippingService, MelhorEnvioService],
  exports: [ShippingService, MelhorEnvioService],
})
export class ShippingModule {}
