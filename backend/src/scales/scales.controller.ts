import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ScalesService } from './scales.service';
import { CreateScaleDto } from './dto/create-scale.dto';
import { UpdateScaleDto } from './dto/update-scale.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('api/v1/scales')
export class ScalesController {
  constructor(private readonly scalesService: ScalesService) {}

  @Public()
  @Get()
  async findAll() {
    return { data: await this.scalesService.findAll() };
  }

  @Roles('ADMIN')
  @Post()
  async create(@Body() dto: CreateScaleDto) {
    return { data: await this.scalesService.create(dto) };
  }

  @Roles('ADMIN')
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateScaleDto) {
    return { data: await this.scalesService.update(id, dto) };
  }

  @Roles('ADMIN')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.scalesService.remove(id);
    return { data: { message: 'Scale deactivated successfully' } };
  }

  @Roles('ADMIN')
  @Post('rules')
  async createRule(
    @Body()
    dto: {
      scaleId: string;
      appliesTo: 'GLOBAL' | 'CATEGORY' | 'TAG' | 'PRODUCT';
      targetId?: string;
      priceMultiplier: number;
      priority: number;
    },
  ) {
    return await this.scalesService.createRule(dto);
  }

  @Public()
  @Get('price/:productId/:scaleId')
  async calculatePrice(
    @Param('productId') _productId: string,
    @Param('scaleId') _scaleId: string,
  ) {
    // Preço base vem do banco, NUNCA do frontend
    return { message: 'Use product endpoint for price with scale' };
  }
}
