import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { AttributesService } from './attributes.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('api/v1/attributes')
export class AttributesController {
  constructor(private readonly attributesService: AttributesService) {}

  @Public()
  @Get()
  async findAll() {
    return await this.attributesService.findAll();
  }

  @Roles('ADMIN')
  @Post()
  async create(@Body() dto: { name: string }) {
    return await this.attributesService.create(dto);
  }

  @Roles('ADMIN')
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: { name?: string }) {
    return await this.attributesService.update(id, dto);
  }

  @Roles('ADMIN')
  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.attributesService.delete(id);
    return { message: 'Attribute deleted' };
  }

  @Roles('ADMIN')
  @Post(':id/values')
  async createValue(@Param('id') id: string, @Body() dto: { value: string }) {
    return await this.attributesService.createValue(id, dto);
  }

  @Roles('ADMIN')
  @Delete('values/:valueId')
  async deleteValue(@Param('valueId') valueId: string) {
    await this.attributesService.deleteValue(valueId);
    return { message: 'Value deleted' };
  }
}
