import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ScalesService {
  constructor(private prisma: PrismaService) {}

  // ── ScaleRuleSet CRUD ──

  async createRuleSet(dto: { name: string }) {
    return this.prisma.scaleRuleSet.create({
      data: { name: dto.name },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async findAllRuleSets() {
    return this.prisma.scaleRuleSet.findMany({
      where: { isActive: true },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  async findRuleSetById(id: string) {
    const ruleSet = await this.prisma.scaleRuleSet.findUnique({
      where: { id },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!ruleSet) throw new NotFoundException('Scale rule set not found');
    return ruleSet;
  }

  async updateRuleSet(id: string, dto: { name?: string }) {
    await this.findRuleSetById(id);
    return this.prisma.scaleRuleSet.update({
      where: { id },
      data: { name: dto.name },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async removeRuleSet(id: string) {
    await this.findRuleSetById(id);
    // Cascade delete: ScaleRuleItems are deleted by Prisma onDelete: Cascade
    return this.prisma.scaleRuleSet.delete({ where: { id } });
  }

  // ── ScaleRuleItem CRUD (dentro de um RuleSet) ──

  async addItem(
    ruleSetId: string,
    dto: { name: string; percentageIncrease: number; sortOrder?: number },
  ) {
    await this.findRuleSetById(ruleSetId);
    return this.prisma.scaleRuleItem.create({
      data: {
        ruleSetId,
        name: dto.name,
        percentageIncrease: dto.percentageIncrease,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateItem(
    itemId: string,
    dto: { name?: string; percentageIncrease?: number; sortOrder?: number },
  ) {
    const item = await this.prisma.scaleRuleItem.findUnique({
      where: { id: itemId },
    });
    if (!item) throw new NotFoundException('Scale rule item not found');
    return this.prisma.scaleRuleItem.update({
      where: { id: itemId },
      data: dto,
    });
  }

  async removeItem(itemId: string) {
    const item = await this.prisma.scaleRuleItem.findUnique({
      where: { id: itemId },
    });
    if (!item) throw new NotFoundException('Scale rule item not found');
    return this.prisma.scaleRuleItem.delete({ where: { id: itemId } });
  }

  // ── Resolve qual regra se aplica a um produto ──

  /**
   * Prioridade: Produto > Tag > Categoria.
   * noScales em produto ou tag = null (sem escalas).
   */
  async resolveScaleRule(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        scaleRuleSet: { include: { items: { orderBy: { sortOrder: 'asc' } } } },
        tags: {
          include: {
            scaleRuleSet: { include: { items: { orderBy: { sortOrder: 'asc' } } } },
          },
        },
        category: {
          include: {
            scaleRuleSet: { include: { items: { orderBy: { sortOrder: 'asc' } } } },
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
