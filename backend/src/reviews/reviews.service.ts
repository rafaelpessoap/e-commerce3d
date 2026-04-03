import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes } from 'crypto';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: {
    userId: string;
    productId: string;
    orderId: string;
    rating: number;
    comment?: string;
    images?: string;
  }) {
    // Validar rating
    if (dto.rating < 1 || dto.rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    // Verificar que o pedido existe, pertence ao user e está DELIVERED
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.userId !== dto.userId) {
      throw new ForbiddenException('Order does not belong to you');
    }

    if (order.status !== 'DELIVERED') {
      throw new BadRequestException(
        'You can only review products from delivered orders',
      );
    }

    // Verificar que o produto faz parte do pedido
    const productInOrder = order.items.some(
      (item) => item.productId === dto.productId,
    );
    if (!productInOrder) {
      throw new BadRequestException('Product was not in this order');
    }

    return this.prisma.review.create({
      data: {
        userId: dto.userId,
        productId: dto.productId,
        orderId: dto.orderId,
        rating: dto.rating,
        comment: dto.comment,
        images: dto.images,
      },
    });
  }

  async findByProduct(productId: string) {
    return this.prisma.review.findMany({
      where: { productId, isApproved: true },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAverageRating(productId: string) {
    const result = await this.prisma.review.aggregate({
      where: { productId, isApproved: true },
      _avg: { rating: true },
      _count: { rating: true },
    });

    return {
      average: result._avg.rating ?? 0,
      count: result._count.rating ?? 0,
    };
  }

  async approve(reviewId: string) {
    return this.prisma.review.update({
      where: { id: reviewId },
      data: { isApproved: true },
    });
  }

  async findAllAdmin() {
    return this.prisma.review.findMany({
      include: {
        user: { select: { name: true, email: true } },
        product: { select: { name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async generateReward(reviewId: string, _userId: string) {
    const code = `REVIEW-${randomBytes(4).toString('hex').toUpperCase()}`;

    const coupon = await this.prisma.coupon.create({
      data: {
        code,
        type: 'PERCENTAGE',
        value: 5,
        usesPerUser: 1,
        maxUses: 1,
        isActive: true,
      },
    });

    return this.prisma.reviewReward.create({
      data: {
        reviewId,
        couponId: coupon.id,
      },
    });
  }
}
