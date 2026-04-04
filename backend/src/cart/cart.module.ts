import { Module } from '@nestjs/common';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { ScalesModule } from '../scales/scales.module';

// RedisModule is @Global, no need to import here
@Module({
  imports: [ScalesModule],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
