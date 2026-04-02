import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import slugify from 'slug';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: {
    name: string;
    description: string;
    content?: string;
    basePrice: number;
    sku?: string;
    categoryId?: string;
    brandId?: string;
    tagIds?: string[];
  }) {
    const slug = slugify(dto.name, { lower: true });

    const existing = await this.prisma.product.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new ConflictException('Product name already exists');
    }

    return this.prisma.product.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        content: dto.content,
        basePrice: dto.basePrice,
        sku: dto.sku,
        categoryId: dto.categoryId,
        brandId: dto.brandId,
        ...(dto.tagIds && {
          tags: { connect: dto.tagIds.map((id) => ({ id })) },
        }),
      },
    });
  }

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        category: true,
        brand: true,
        tags: true,
        images: { orderBy: { order: 'asc' } },
        variations: { include: { scale: true } },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async findAll(params: {
    page: number;
    perPage: number;
    categoryId?: string;
    brandId?: string;
    search?: string;
  }) {
    const { page, perPage, categoryId, brandId, search } = params;
    const skip = (page - 1) * perPage;

    const where: Record<string, any> = { isActive: true };
    if (categoryId) where.categoryId = categoryId;
    if (brandId) where.brandId = brandId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          category: true,
          brand: true,
          images: { where: { isMain: true }, take: 1 },
        },
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        perPage,
        lastPage: Math.ceil(total / perPage),
      },
    };
  }

  async update(
    id: string,
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
    const data: Record<string, any> = { ...dto };

    if (dto.name) {
      data.slug = slugify(dto.name, { lower: true });
    }

    return this.prisma.product.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
