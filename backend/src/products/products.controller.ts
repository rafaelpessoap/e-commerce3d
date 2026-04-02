import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('api/v1/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Public()
  @Get()
  async findAll(
    @Query('page') page = '1',
    @Query('perPage') perPage = '20',
    @Query('categoryId') categoryId?: string,
    @Query('brandId') brandId?: string,
    @Query('search') search?: string,
  ) {
    const result = await this.productsService.findAll({
      page: parseInt(page, 10),
      perPage: parseInt(perPage, 10),
      categoryId,
      brandId,
      search,
    });
    return result;
  }

  @Public()
  @Get(':slug')
  async findBySlug(@Param('slug') slug: string) {
    return { data: await this.productsService.findBySlug(slug) };
  }

  @Roles('ADMIN')
  @Post()
  async create(
    @Body()
    dto: {
      name: string;
      description: string;
      content?: string;
      basePrice: number;
      sku?: string;
      categoryId?: string;
      brandId?: string;
      tagIds?: string[];
    },
  ) {
    return { data: await this.productsService.create(dto) };
  }

  @Roles('ADMIN')
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body()
    dto: {
      name?: string;
      description?: string;
      content?: string;
      basePrice?: number;
      categoryId?: string;
      brandId?: string;
      featured?: boolean;
    },
  ) {
    return { data: await this.productsService.update(id, dto) };
  }

  @Roles('ADMIN')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.productsService.remove(id);
    return { data: { message: 'Product deactivated successfully' } };
  }
}
