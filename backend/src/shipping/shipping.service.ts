import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ShippingService {
  constructor(private prisma: PrismaService) {}

  async checkFreeShipping(
    zipCode: string,
    orderValue: number,
  ): Promise<boolean> {
    const rules = await this.prisma.freeShippingRule.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    for (const rule of rules) {
      const zip = zipCode.replace(/\D/g, '');
      if (
        zip >= rule.zipCodeStart &&
        zip <= rule.zipCodeEnd &&
        orderValue >= rule.minOrderValue
      ) {
        return true;
      }
    }

    return false;
  }

  async createFreeShippingRule(dto: {
    zipCodeStart: string;
    zipCodeEnd: string;
    minOrderValue: number;
  }) {
    return this.prisma.freeShippingRule.create({ data: dto });
  }

  async findAllFreeShippingRules() {
    return this.prisma.freeShippingRule.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateFreeShippingRule(
    id: string,
    dto: { minOrderValue?: number; isActive?: boolean },
  ) {
    return this.prisma.freeShippingRule.update({ where: { id }, data: dto });
  }
}
