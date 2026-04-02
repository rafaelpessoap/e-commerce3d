import { Controller, Get, Post, Put, Body, Param } from '@nestjs/common';
import { ShippingService } from './shipping.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('api/v1/shipping')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Public()
  @Post('simulate')
  async simulate(@Body() dto: { zipCode: string; orderValue: number }) {
    const isFree = await this.shippingService.checkFreeShipping(
      dto.zipCode,
      dto.orderValue,
    );
    return { data: { freeShipping: isFree } };
  }

  @Roles('ADMIN')
  @Get('free-rules')
  async findAllRules() {
    return { data: await this.shippingService.findAllFreeShippingRules() };
  }

  @Roles('ADMIN')
  @Post('free-rules')
  async createRule(@Body() dto: { zipCodeStart: string; zipCodeEnd: string; minOrderValue: number }) {
    return { data: await this.shippingService.createFreeShippingRule(dto) };
  }

  @Roles('ADMIN')
  @Put('free-rules/:id')
  async updateRule(@Param('id') id: string, @Body() dto: { minOrderValue?: number; isActive?: boolean }) {
    return { data: await this.shippingService.updateFreeShippingRule(id, dto) };
  }
}
