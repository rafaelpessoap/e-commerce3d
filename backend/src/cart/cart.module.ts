import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

@Module({
  imports: [CacheModule.register()],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
