import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('api/v1/coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Roles('ADMIN')
  @Get()
  async findAll() {
    return { data: await this.couponsService.findAll() };
  }

  @Roles('ADMIN')
  @Post()
  async create(@Body() dto: any) {
    return { data: await this.couponsService.create(dto) };
  }

  @Public()
  @Post('validate')
  async validate(@Body() dto: { code: string; cartValue: number; userId?: string }) {
    return { data: await this.couponsService.validate(dto) };
  }

  @Roles('ADMIN')
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: any) {
    return { data: await this.couponsService.update(id, dto) };
  }

  @Roles('ADMIN')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.couponsService.remove(id);
    return { data: { message: 'Coupon deactivated successfully' } };
  }
}
