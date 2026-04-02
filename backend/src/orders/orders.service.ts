import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes } from 'crypto';

// State machine: valid transitions
const STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
};

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  isValidTransition(from: string, to: string): boolean {
    return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
  }

  private generateOrderNumber(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const hash = randomBytes(3).toString('hex').toUpperCase();
    return `ORD-${date}-${hash}`;
  }

  async createOrder(params: {
    userId: string;
    items: Array<{
      productId: string;
      variationId?: string;
      quantity: number;
      price: number;
    }>;
    subtotal: number;
    shipping?: number;
    discount?: number;
    total: number;
    shippingAddress?: string;
    couponId?: string;
    paymentMethod?: string;
  }) {
    return this.prisma.order.create({
      data: {
        number: this.generateOrderNumber(),
        userId: params.userId,
        status: 'PENDING',
        subtotal: params.subtotal,
        shipping: params.shipping ?? 0,
        discount: params.discount ?? 0,
        total: params.total,
        shippingAddress: params.shippingAddress,
        couponId: params.couponId,
        paymentMethod: params.paymentMethod,
        items: {
          create: params.items.map((item) => ({
            productId: item.productId,
            variationId: item.variationId,
            quantity: item.quantity,
            price: item.price,
          })),
        },
      },
      include: { items: true },
    });
  }

  async updateStatus(orderId: string, newStatus: string, userId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!this.isValidTransition(order.status, newStatus)) {
      throw new BadRequestException(
        `Invalid transition from ${order.status} to ${newStatus}`,
      );
    }

    // Registrar historico da transicao
    await this.prisma.orderStatusHistory.create({
      data: {
        orderId,
        fromStatus: order.status,
        toStatus: newStatus,
        createdBy: userId,
      },
    });

    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: newStatus as any },
    });
  }

  async findAll(params: {
    page: number;
    perPage: number;
    userId?: string;
    status?: string;
  }) {
    const { page, perPage, userId, status } = params;
    const skip = (page - 1) * perPage;

    const where: Record<string, any> = {};
    if (userId) where.userId = userId;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { items: true },
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        perPage,
        lastPage: Math.ceil(total / perPage) || 1,
      },
    };
  }

  async findById(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: true, variation: true } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async trackByNumber(orderNumber: string) {
    const order = await this.prisma.order.findUnique({
      where: { number: orderNumber },
      select: {
        number: true,
        status: true,
        trackingCode: true,
        createdAt: true,
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }
}
