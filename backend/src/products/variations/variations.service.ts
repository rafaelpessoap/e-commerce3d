import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class VariationsService {
  constructor(private prisma: PrismaService) {}

  async findByProduct(productId: string) {
    return this.prisma.productVariation.findMany({
      where: { productId },
      include: { scale: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(
    productId: string,
    dto: {
      name: string;
      scaleId?: string;
      sku?: string;
      price: number;
      stock?: number;
    },
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.prisma.productVariation.create({
      data: { productId, ...dto },
      include: { scale: true },
    });
  }

  async update(
    id: string,
    dto: { price?: number; stock?: number; name?: string },
  ) {
    return this.prisma.productVariation.update({
      where: { id },
      data: dto,
      include: { scale: true },
    });
  }

  async remove(id: string) {
    return this.prisma.productVariation.delete({ where: { id } });
  }
}
