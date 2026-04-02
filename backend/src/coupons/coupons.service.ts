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
      },
    });
  }

  async findAll() {
    return this.prisma.coupon.findMany({
      include: { _count: { select: { usages: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async validate(params: {
    code: string;
    cartValue: number;
    userId?: string;
  }): Promise<{ discount: number; type: string; couponId: string }> {
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

    if (params.userId && coupon.isFirstPurchaseOnly) {
      const orderCount = await this.prisma.order.count({
        where: { userId: params.userId },
      });
      if (orderCount > 0) {
        throw new BadRequestException(
          'This coupon is for first purchase only',
        );
      }
    }

    let discount = 0;
    if (coupon.type === 'PERCENTAGE') {
      discount = Math.round(params.cartValue * (coupon.value / 100) * 100) / 100;
    } else if (coupon.type === 'FIXED') {
      discount = Math.min(coupon.value, params.cartValue);
    }
    // FREE_SHIPPING: discount = 0, handled by shipping module

    return {
      discount,
      type: coupon.type,
      couponId: coupon.id,
    };
  }

  async update(
    id: string,
    dto: {
      value?: number;
      minOrderValue?: number;
      maxUses?: number;
      isActive?: boolean;
      validUntil?: Date;
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
