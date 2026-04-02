import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { VariationsController } from './variations/variations.controller';
import { VariationsService } from './variations/variations.service';

@Module({
  controllers: [ProductsController, VariationsController],
  providers: [ProductsService, VariationsService],
  exports: [ProductsService, VariationsService],
})
export class ProductsModule {}
