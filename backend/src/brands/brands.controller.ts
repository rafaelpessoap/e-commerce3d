import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { BrandsService } from './brands.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('api/v1/brands')
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Public()
  @Get()
  async findAll() {
    return { data: await this.brandsService.findAll() };
  }

  @Public()
  @Get(':slug')
  async findBySlug(@Param('slug') slug: string) {
    return { data: await this.brandsService.findBySlug(slug) };
  }

  @Roles('ADMIN')
  @Post()
  async create(@Body() dto: { name: string; description?: string; logo?: string }) {
    return { data: await this.brandsService.create(dto) };
  }

  @Roles('ADMIN')
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: { name?: string; description?: string; logo?: string }) {
    return { data: await this.brandsService.update(id, dto) };
  }

  @Roles('ADMIN')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.brandsService.remove(id);
    return { data: { message: 'Brand deactivated successfully' } };
  }
}
