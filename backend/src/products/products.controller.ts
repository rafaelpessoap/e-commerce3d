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
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

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
    @Query('attributes') attributes?: string,
    @Query('priceMin') priceMin?: string,
    @Query('priceMax') priceMax?: string,
  ) {
    return await this.productsService.findAll({
      page: parseInt(page, 10),
      perPage: parseInt(perPage, 10),
      categoryId,
      brandId,
      search,
      attributeValueIds: attributes ? attributes.split(',') : undefined,
      priceMin: priceMin ? parseFloat(priceMin) : undefined,
      priceMax: priceMax ? parseFloat(priceMax) : undefined,
    });
  }

  @Public()
  @Get(':slugOrId')
  async findBySlugOrId(@Param('slugOrId') slugOrId: string) {
    // Se parece com cuid (começa com c + 24 chars), busca por ID
    if (/^c[a-z0-9]{24,}$/.test(slugOrId)) {
      return await this.productsService.findById(slugOrId);
    }
    return await this.productsService.findBySlug(slugOrId);
  }

  @Public()
  @Get(':id/delivery-info')
  async getDeliveryInfo(@Param('id') id: string) {
    const extraDays = await this.productsService.resolveExtraDays(id);
    return { baseDays: 3, extraDays, totalDays: 3 + extraDays };
  }

  @Roles('ADMIN')
  @Post()
  async create(@Body() dto: CreateProductDto) {
    return await this.productsService.create(dto);
  }

  @Roles('ADMIN')
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: { id: string },
  ) {
    return await this.productsService.update(id, dto, user.id);
  }

  @Roles('ADMIN')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.productsService.remove(id);
    return { message: 'Product deactivated successfully' };
  }
}
