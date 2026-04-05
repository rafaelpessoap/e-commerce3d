import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { ScalesService } from './scales.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('api/v1/scales')
export class ScalesController {
  constructor(private readonly scalesService: ScalesService) {}

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
  async createRuleSet(@Body() dto: { name: string }) {
    return { data: await this.scalesService.createRuleSet(dto) };
  }

  @Roles('ADMIN')
  @Put('rule-sets/:id')
  async updateRuleSet(
    @Param('id') id: string,
    @Body() dto: { name?: string },
  ) {
    return { data: await this.scalesService.updateRuleSet(id, dto) };
  }

  @Roles('ADMIN')
  @Delete('rule-sets/:id')
  async removeRuleSet(@Param('id') id: string) {
    await this.scalesService.removeRuleSet(id);
    return { data: { message: 'Scale rule set deleted' } };
  }

  // ── ScaleRuleItem CRUD (dentro de um RuleSet) ──

  @Roles('ADMIN')
  @Post('rule-sets/:ruleSetId/items')
  async addItem(
    @Param('ruleSetId') ruleSetId: string,
    @Body() dto: { name: string; percentageIncrease: number; sortOrder?: number },
  ) {
    return { data: await this.scalesService.addItem(ruleSetId, dto) };
  }

  @Roles('ADMIN')
  @Put('items/:itemId')
  async updateItem(
    @Param('itemId') itemId: string,
    @Body() dto: { name?: string; percentageIncrease?: number; sortOrder?: number },
  ) {
    return { data: await this.scalesService.updateItem(itemId, dto) };
  }

  @Roles('ADMIN')
  @Delete('items/:itemId')
  async removeItem(@Param('itemId') itemId: string) {
    await this.scalesService.removeItem(itemId);
    return { data: { message: 'Scale item deleted' } };
  }

  // ── Endpoint publico: escalas aplicaveis a um produto ──

  @Public()
  @Get('for-product/:productId')
  async forProduct(@Param('productId') productId: string) {
    const ruleSet = await this.scalesService.resolveScaleRule(productId);
    return { data: ruleSet };
  }
}
