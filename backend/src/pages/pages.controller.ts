import { Controller, Get, Post, Put, Param, Body } from '@nestjs/common';
import { PagesService } from './pages.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('api/v1/pages')
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Public()
  @Get(':slug')
  async findBySlug(@Param('slug') slug: string) {
    return await this.pagesService.findBySlug(slug);
  }

  @Roles('ADMIN')
  @Get()
  async findAll() {
    return await this.pagesService.findAll();
  }

  @Roles('ADMIN')
  @Post()
  async create(@Body() dto: { title: string; content: string }) {
    return await this.pagesService.create(dto);
  }

  @Roles('ADMIN')
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: any) {
    return await this.pagesService.update(id, dto);
  }
}
