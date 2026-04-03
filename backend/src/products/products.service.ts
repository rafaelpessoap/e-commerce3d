import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import slugify from 'slug';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateProductDto) {
    const slug = dto.slug || slugify(dto.name, { lower: true });

    const existing = await this.prisma.product.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException('Product slug already exists');
    }

    const { tagIds, attributeValueIds, images, ...productData } = dto;

    const product = await this.prisma.product.create({
      data: {
        ...productData,
        slug,
        ...(tagIds?.length && {
          tags: { connect: tagIds.map((id) => ({ id })) },
        }),
        ...(attributeValueIds?.length && {
          attributes: {
            create: attributeValueIds.map((avId) => ({
              attributeValueId: avId,
            })),
          },
        }),
        ...(images?.length && {
          images: {
            create: images.map((img) => ({
              mediaFileId: img.mediaFileId,
              isMain: img.isMain,
              order: img.order,
            })),
          },
        }),
      },
      include: {
        category: true,
        brand: true,
        tags: true,
        images: { include: { mediaFile: true }, orderBy: { order: 'asc' } },
        attributes: { include: { attributeValue: { include: { attribute: true } } } },
      },
    });

    return product;
  }

  async findById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        brand: true,
        tags: true,
        images: { include: { mediaFile: true }, orderBy: { order: 'asc' } },
        variations: { include: { scale: true } },
        attributes: { include: { attributeValue: { include: { attribute: true } } } },
        relatedProducts: true,
      },
    });

    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        category: true,
        brand: true,
        tags: true,
        images: { include: { mediaFile: true }, orderBy: { order: 'asc' } },
        variations: { include: { scale: true } },
        attributes: { include: { attributeValue: { include: { attribute: true } } } },
        relatedProducts: true,
      },
    });

    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async findAll(params: {
    page: number;
    perPage: number;
    categoryId?: string;
    brandId?: string;
    search?: string;
    attributeValueIds?: string[];
    priceMin?: number;
    priceMax?: number;
  }) {
    const { page, perPage, categoryId, brandId, search, attributeValueIds, priceMin, priceMax } = params;
    const skip = (page - 1) * perPage;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { isActive: true };
    if (categoryId) where.categoryId = categoryId;
    if (brandId) where.brandId = brandId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (attributeValueIds?.length) {
      where.attributes = {
        some: { attributeValueId: { in: attributeValueIds } },
      };
    }
    if (priceMin !== undefined || priceMax !== undefined) {
      where.basePrice = {};
      if (priceMin !== undefined) where.basePrice.gte = priceMin;
      if (priceMax !== undefined) where.basePrice.lte = priceMax;
    }

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          category: true,
          brand: true,
          images: { include: { mediaFile: true }, where: { isMain: true }, take: 1 },
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

  async update(id: string, dto: UpdateProductDto) {
    const { tagIds, attributeValueIds, images, ...updateData } = dto;

    // Se nome mudou e slug não foi enviado, auto-gera
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = { ...updateData };
    if (dto.name && !dto.slug) {
      data.slug = slugify(dto.name, { lower: true });
    }

    // Atualiza tags (disconnect all, reconnect)
    if (tagIds !== undefined) {
      data.tags = {
        set: tagIds.map((id) => ({ id })),
      };
    }

    // Atualiza atributos (delete all, recreate)
    if (attributeValueIds !== undefined) {
      await this.prisma.productAttribute.deleteMany({ where: { productId: id } });
      if (attributeValueIds.length > 0) {
        await this.prisma.productAttribute.createMany({
          data: attributeValueIds.map((avId) => ({
            productId: id,
            attributeValueId: avId,
          })),
        });
      }
    }

    // Atualiza imagens (delete all, recreate)
    if (images !== undefined) {
      await this.prisma.productImage.deleteMany({ where: { productId: id } });
      if (images.length > 0) {
        await this.prisma.productImage.createMany({
          data: images.map((img) => ({
            productId: id,
            mediaFileId: img.mediaFileId,
            isMain: img.isMain,
            order: img.order,
          })),
        });
      }
    }

    return this.prisma.product.update({
      where: { id },
      data,
      include: {
        category: true,
        brand: true,
        tags: true,
        images: { include: { mediaFile: true }, orderBy: { order: 'asc' } },
        attributes: { include: { attributeValue: { include: { attribute: true } } } },
      },
    });
  }

  async remove(id: string) {
    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Resolve dias adicionais de entrega.
   * Prioridade: produto > tag (maior valor) > categoria
   */
  async resolveExtraDays(productId: string): Promise<number> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { tags: true, category: true },
    });

    if (!product) return 0;

    // 1. Produto tem override
    if (product.extraDays != null) return product.extraDays;

    // 2. Tags — usa o maior
    const tagDays = product.tags
      .map((t) => t.extraDays)
      .filter((d): d is number => d != null);
    if (tagDays.length > 0) return Math.max(...tagDays);

    // 3. Categoria
    if (product.category?.extraDays != null) return product.category.extraDays;

    return 0;
  }
}
