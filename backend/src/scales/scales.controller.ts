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

  // ── ScaleRuleSet CRUD ──

  @Public()
  @Get('rule-sets')
  async findAllRuleSets() {
    return { data: await this.scalesService.findAllRuleSets() };
  }

  @Public()
  @Get('rule-sets/:id')
  async findRuleSetById(@Param('id') id: string) {
    return { data: await this.scalesService.findRuleSetById(id) };
  }

  @Roles('ADMIN')
  @Post('rule-sets')
  async createRuleSet(
    @Body() dto: { name: string; items: Array<{ scaleId: string; percentageIncrease: number }> },
  ) {
    return { data: await this.scalesService.createRuleSet(dto) };
  }

  @Roles('ADMIN')
  @Put('rule-sets/:id')
  async updateRuleSet(
    @Param('id') id: string,
    @Body() dto: { name?: string; items?: Array<{ scaleId: string; percentageIncrease: number }> },
  ) {
    return { data: await this.scalesService.updateRuleSet(id, dto) };
  }

  @Roles('ADMIN')
  @Delete('rule-sets/:id')
  async removeRuleSet(@Param('id') id: string) {
    await this.scalesService.removeRuleSet(id);
    return { data: { message: 'Scale rule set deactivated' } };
  }

  // ── Endpoint publico: escalas aplicaveis a um produto ──

  @Public()
  @Get('for-product/:productId')
  async forProduct(@Param('productId') productId: string) {
    const ruleSet = await this.scalesService.resolveScaleRule(productId);
    return { data: ruleSet };
  }
}
