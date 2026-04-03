import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ScalesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: {
    name: string;
    code: string;
    baseSize: number;
    multiplier?: number;
    priority?: number;
  }) {
    return this.prisma.scale.create({
      data: {
        name: dto.name,
        code: dto.code.toUpperCase(),
        baseSize: dto.baseSize,
        multiplier: dto.multiplier ?? 1.0,
        priority: dto.priority ?? 0,
      },
    });
  }

  async findAll() {
    return this.prisma.scale.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' },
    });
  }

  /**
   * CRITICO: Calcula preco baseado em regras de escala.
   * Hierarquia de prioridade: PRODUCT > TAG > CATEGORY > GLOBAL
   * A regra com maior priority e aplicada.
   */
  async calculatePrice(
    basePrice: number,
    productId: string,
    scaleId: string,
    categoryId?: string,
  ): Promise<number> {
    const rules = await this.prisma.scaleRule.findMany({
      where: {
        scaleId,
        OR: [
          { appliesTo: 'PRODUCT', targetId: productId },
          ...(categoryId
            ? [{ appliesTo: 'CATEGORY' as const, targetId: categoryId }]
            : []),
          { appliesTo: 'GLOBAL' },
        ],
      },
      orderBy: { priority: 'desc' },
    });

    if (rules.length === 0) {
      return basePrice;
    }

    const applicableRule = rules[0];
    return Math.round(basePrice * applicableRule.priceMultiplier * 100) / 100;
  }

  async update(
    id: string,
    dto: {
      name?: string;
      code?: string;
      baseSize?: number;
      multiplier?: number;
      priority?: number;
    },
  ) {
    const existing = await this.prisma.scale.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Scale not found');
    }
    const data: Record<string, any> = { ...dto };
    if (dto.code) {
      data.code = dto.code.toUpperCase();
    }
    return this.prisma.scale.update({ where: { id }, data });
  }

  async remove(id: string) {
    const existing = await this.prisma.scale.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Scale not found');
    }
    return this.prisma.scale.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async createRule(dto: {
    scaleId: string;
    appliesTo: 'GLOBAL' | 'CATEGORY' | 'TAG' | 'PRODUCT';
    targetId?: string;
    priceMultiplier: number;
    priority: number;
  }) {
    return this.prisma.scaleRule.create({ data: dto });
  }
}
