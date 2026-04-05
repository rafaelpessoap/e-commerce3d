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

    const { tagIds, attributeValueIds, images, variations, ...productData } = dto;

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

    // Create variations after product exists
    if (variations?.length) {
      await this.prisma.productVariation.createMany({
        data: variations.map((v) => ({
          productId: product.id,
          name: v.name,
          sku: v.sku ?? '',
          gtin: v.gtin,
          price: v.price,
          salePrice: v.salePrice,
          stock: v.stock ?? 0,
          weight: v.weight,
          width: v.width,
          height: v.height,
          length: v.length,
          image: v.image,
        })),
      });
    }

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
        variations: true,
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
        variations: true,
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

  async update(id: string, dto: UpdateProductDto, adminUserId?: string) {
    const { tagIds, attributeValueIds, images, variations, ...updateData } = dto;

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

    // Audit log for stock changes (product-level)
    if (dto.stock !== undefined && adminUserId) {
      const current = await this.prisma.product.findUnique({ where: { id } });
      if (current && current.stock !== dto.stock) {
        const delta = dto.stock - current.stock;
        await this.prisma.stockAuditLog.create({
          data: {
            productId: id,
            quantityBefore: current.stock,
            quantityAfter: dto.stock,
            delta,
            reason: 'ADMIN_ADJUSTMENT',
            referenceId: adminUserId,
          },
        });
        // Prune: keep only last 30
        const old = await this.prisma.stockAuditLog.findMany({
          where: { productId: id, variationId: null },
          orderBy: { createdAt: 'desc' as const },
          skip: 30,
          select: { id: true },
        });
        if (old.length > 0) {
          await this.prisma.stockAuditLog.deleteMany({
            where: { id: { in: old.map((l: { id: string }) => l.id) } },
          });
        }
      }
    }

    // Sync variations: update existing, create new, delete removed
    if (variations !== undefined) {
      const existingVariations = await this.prisma.productVariation.findMany({
        where: { productId: id },
      });

      const incomingIds = variations.filter((v) => v.id).map((v) => v.id!);
      const toDelete = existingVariations.filter((ev) => !incomingIds.includes(ev.id));
      const toUpdate = variations.filter((v) => v.id);
      const toCreate = variations.filter((v) => !v.id);

      // Delete removed
      if (toDelete.length > 0) {
        await this.prisma.productVariation.deleteMany({
          where: { id: { in: toDelete.map((v) => v.id) } },
        });
      }

      // Update existing (with audit log for stock changes)
      for (const v of toUpdate) {
        const existing = existingVariations.find((ev) => ev.id === v.id);
        const newStock = v.stock ?? 0;

        await this.prisma.productVariation.update({
          where: { id: v.id },
          data: {
            name: v.name,
            sku: v.sku ?? '',
            gtin: v.gtin,
            price: v.price,
            salePrice: v.salePrice,
            stock: newStock,
            weight: v.weight,
            width: v.width,
            height: v.height,
            length: v.length,
            image: v.image,
          },
        });

        // Audit log if stock changed
        if (existing && existing.stock !== newStock && adminUserId) {
          await this.prisma.stockAuditLog.create({
            data: {
              productId: id,
              variationId: v.id,
              quantityBefore: existing.stock,
              quantityAfter: newStock,
              delta: newStock - existing.stock,
              reason: 'ADMIN_ADJUSTMENT',
              referenceId: adminUserId,
            },
          });
        }
      }

      // Create new
      if (toCreate.length > 0) {
        await this.prisma.productVariation.createMany({
          data: toCreate.map((v) => ({
            productId: id,
            name: v.name,
            sku: v.sku ?? '',
            gtin: v.gtin,
            price: v.price,
            salePrice: v.salePrice,
            stock: v.stock ?? 0,
            weight: v.weight,
            width: v.width,
            height: v.height,
            length: v.length,
            image: v.image,
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
        variations: true,
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

  /**
   * Resolve dados de frete para um produto (ou variação específica).
   * Variação herda peso/dimensões do pai quando null.
   * Preço: salePrice ?? price (variação) ou salePrice ?? basePrice (simples).
   */
  async resolveShippingData(
    productId: string,
    variationId?: string,
  ): Promise<{
    weight: number | null;
    width: number | null;
    height: number | null;
    length: number | null;
    price: number;
  }> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { variations: true },
    });

    if (!product) throw new NotFoundException('Product not found');

    if (variationId) {
      const variation = product.variations.find(
        (v: { id: string }) => v.id === variationId,
      );
      if (!variation) {
        throw new NotFoundException('Variation not found in this product');
      }

      return {
        weight: variation.weight ?? product.weight,
        width: variation.width ?? product.width,
        height: variation.height ?? product.height,
        length: variation.length ?? product.length,
        price: variation.salePrice ?? variation.price,
      };
    }

    // Produto simples
    return {
      weight: product.weight,
      width: product.width,
      height: product.height,
      length: product.length,
      price: product.salePrice ?? product.basePrice,
    };
  }
}
