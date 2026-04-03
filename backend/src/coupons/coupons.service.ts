import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CouponsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: {
    code: string;
    type: 'PERCENTAGE' | 'FIXED' | 'FREE_SHIPPING';
    value: number;
    minOrderValue?: number;
    maxUses?: number;
    usesPerUser?: number;
    validFrom?: Date;
    validUntil?: Date;
    isFirstPurchaseOnly?: boolean;
    categoryId?: string;
    tagId?: string;
    userId?: string;
  }) {
    return this.prisma.coupon.create({
      data: {
        code: dto.code.toUpperCase(),
        type: dto.type,
        value: dto.value,
        minOrderValue: dto.minOrderValue,
        maxUses: dto.maxUses,
        usesPerUser: dto.usesPerUser,
        validFrom: dto.validFrom,
        validUntil: dto.validUntil,
        isFirstPurchaseOnly: dto.isFirstPurchaseOnly ?? false,
        categoryId: dto.categoryId,
        tagId: dto.tagId,
        userId: dto.userId,
      },
    });
  }

  async findAll() {
    return this.prisma.coupon.findMany({
      include: {
        _count: { select: { usages: true } },
        category: { select: { id: true, name: true } },
        tag: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async validate(params: {
    code: string;
    cartValue: number;
    userId?: string;
  }): Promise<{ discount: number; type: string; couponId: string; categoryId?: string | null; tagId?: string | null }> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: params.code.toUpperCase() },
      include: { _count: { select: { usages: true } } },
    });

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    if (!coupon.isActive) {
      throw new BadRequestException('Coupon is not active');
    }

    const now = new Date();

    if (coupon.validFrom && now < coupon.validFrom) {
      throw new BadRequestException('Coupon is not yet valid');
    }

    if (coupon.validUntil && now > coupon.validUntil) {
      throw new BadRequestException('Coupon has expired');
    }

    if (coupon.minOrderValue && params.cartValue < coupon.minOrderValue) {
      throw new BadRequestException(
        `Minimum order value is ${coupon.minOrderValue}`,
      );
    }

    if (coupon.maxUses && coupon._count.usages >= coupon.maxUses) {
      throw new BadRequestException('Coupon usage limit reached');
    }

    if (params.userId && coupon.usesPerUser) {
      const userUsages = await this.prisma.couponUsage.count({
        where: { couponId: coupon.id, userId: params.userId },
      });
      if (userUsages >= coupon.usesPerUser) {
        throw new BadRequestException('You have already used this coupon');
      }
    }

    // Cupom exclusivo para um cliente
    if (coupon.userId && coupon.userId !== params.userId) {
      throw new BadRequestException('This coupon is not available for your account');
    }

    if (params.userId && coupon.isFirstPurchaseOnly) {
      const orderCount = await this.prisma.order.count({
        where: { userId: params.userId },
      });
      if (orderCount > 0) {
        throw new BadRequestException('This coupon is for first purchase only');
      }
    }

    let discount = 0;
    if (coupon.type === 'PERCENTAGE') {
      discount =
        Math.round(params.cartValue * (coupon.value / 100) * 100) / 100;
    } else if (coupon.type === 'FIXED') {
      discount = Math.min(coupon.value, params.cartValue);
    }
    // FREE_SHIPPING: discount = 0, handled by shipping module

    return {
      discount,
      type: coupon.type,
      couponId: coupon.id,
      categoryId: coupon.categoryId,
      tagId: coupon.tagId,
    };
  }

  async update(
    id: string,
    dto: {
      code?: string;
      type?: 'PERCENTAGE' | 'FIXED' | 'FREE_SHIPPING';
      value?: number;
      minOrderValue?: number | null;
      maxUses?: number | null;
      usesPerUser?: number | null;
      validFrom?: Date | null;
      validUntil?: Date | null;
      isFirstPurchaseOnly?: boolean;
      isActive?: boolean;
      categoryId?: string | null;
      tagId?: string | null;
      userId?: string | null;
    },
  ) {
    return this.prisma.coupon.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    return this.prisma.coupon.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
