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

  // ── Novo sistema ScaleRuleSet ──

  async createRuleSet(dto: {
    name: string;
    items: Array<{ scaleId: string; percentageIncrease: number }>;
  }) {
    return this.prisma.scaleRuleSet.create({
      data: {
        name: dto.name,
        items: {
          create: dto.items.map((i) => ({
            scaleId: i.scaleId,
            percentageIncrease: i.percentageIncrease,
          })),
        },
      },
      include: { items: { include: { scale: true } } },
    });
  }

  async findAllRuleSets() {
    return this.prisma.scaleRuleSet.findMany({
      where: { isActive: true },
      include: { items: { include: { scale: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findRuleSetById(id: string) {
    const ruleSet = await this.prisma.scaleRuleSet.findUnique({
      where: { id },
      include: { items: { include: { scale: true } } },
    });
    if (!ruleSet) throw new NotFoundException('Scale rule set not found');
    return ruleSet;
  }

  async updateRuleSet(
    id: string,
    dto: {
      name?: string;
      items?: Array<{ scaleId: string; percentageIncrease: number }>;
    },
  ) {
    await this.findRuleSetById(id);

    if (dto.items !== undefined) {
      await this.prisma.scaleRuleItem.deleteMany({ where: { ruleSetId: id } });
      if (dto.items.length > 0) {
        await this.prisma.scaleRuleItem.createMany({
          data: dto.items.map((i) => ({
            ruleSetId: id,
            scaleId: i.scaleId,
            percentageIncrease: i.percentageIncrease,
          })),
        });
      }
    }

    return this.prisma.scaleRuleSet.update({
      where: { id },
      data: { name: dto.name },
      include: { items: { include: { scale: true } } },
    });
  }

  async removeRuleSet(id: string) {
    await this.findRuleSetById(id);
    return this.prisma.scaleRuleSet.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Resolve qual regra de escala se aplica a um produto.
   * Prioridade: Produto > Tag > Categoria.
   * noScales em produto ou tag = null (sem escalas).
   */
  async resolveScaleRule(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        scaleRuleSet: { include: { items: { include: { scale: true } } } },
        tags: {
          include: {
            scaleRuleSet: { include: { items: { include: { scale: true } } } },
          },
        },
        category: {
          include: {
            scaleRuleSet: { include: { items: { include: { scale: true } } } },
          },
        },
      },
    });

    if (!product) throw new NotFoundException('Product not found');

    // 1. Produto com noScales = sem escalas
    if (product.noScales) return null;

    // 2. Produto tem regra propria = maior prioridade
    if (product.scaleRuleSet) return product.scaleRuleSet;

    // 3. Tags: verificar noScales e regra
    for (const tag of product.tags ?? []) {
      if ((tag as any).noScales) return null;
    }
    for (const tag of product.tags ?? []) {
      if ((tag as any).scaleRuleSet) return (tag as any).scaleRuleSet;
    }

    // 4. Categoria
    if ((product.category as any)?.scaleRuleSet) {
      return (product.category as any).scaleRuleSet;
    }

    return null;
  }

  /**
   * Calcula preco com incremento percentual de escala.
   * Ex: calculateScalePrice(79, 80) = 79 * 1.80 = 142.20
   */
  calculateScalePrice(basePrice: number, percentageIncrease: number): number {
    return Math.round(basePrice * (1 + percentageIncrease / 100) * 100) / 100;
  }
}
