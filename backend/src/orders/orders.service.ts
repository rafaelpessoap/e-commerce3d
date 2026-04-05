import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../stock/stock.service';
import { PricingService } from '../pricing/pricing.service';
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
  constructor(
    private prisma: PrismaService,
    private stockService: StockService,
    private pricingService: PricingService,
  ) {}

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
      scaleId?: string;
      quantity: number;
      price?: number; // ignorado — recalculado pelo PricingService
    }>;
    subtotal?: number; // ignorado
    shipping?: number;
    shippingZipCode?: string;
    discount?: number; // ignorado — calculado pelo PricingService
    total?: number; // ignorado
    shippingAddress?: string;
    shippingServiceName?: string;
    couponCode?: string;
    paymentMethod?: string;
  }) {
    // SEGURANÇA: PricingService recalcula TODOS os preços do banco
    // Valida escala, cupom, frete — nunca confia no frontend
    const pricing = await this.pricingService.calculateOrderPricing({
      userId: params.userId,
      items: params.items.map((i) => ({
        productId: i.productId,
        variationId: i.variationId,
        scaleId: i.scaleId,
        quantity: i.quantity,
      })),
      couponCode: params.couponCode,
      shippingAmount: params.shipping ?? 0,
      shippingZipCode: params.shippingZipCode,
      paymentMethod: params.paymentMethod,
    });

    const order = await this.prisma.order.create({
      data: {
        number: this.generateOrderNumber(),
        userId: params.userId,
        status: 'PENDING',
        subtotal: pricing.subtotal,
        shipping: pricing.shipping,
        discount: pricing.couponDiscount,
        total: pricing.total,
        shippingAddress: params.shippingAddress,
        shippingServiceName: params.shippingServiceName,
        couponId: pricing.couponId,
        paymentMethod: params.paymentMethod,
        items: {
          create: pricing.items.map((item) => ({
            productId: item.productId,
            variationId: item.variationId,
            quantity: item.quantity,
            price: item.unitPrice,
          })),
        },
      },
      include: { items: true },
    });

    // Reservar estoque (incrementa reservedStock, não decrementa stock)
    await this.stockService.reserveStock(
      order.id,
      pricing.items.map((item) => ({
        productId: item.productId,
        variationId: item.variationId,
        quantity: item.quantity,
      })),
    );

    return order;
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

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: newStatus as any },
    });

    // Liberar estoque reservado ao cancelar
    if (newStatus === 'CANCELLED') {
      await this.stockService.releaseStock(orderId, 'ORDER_CANCELLED');
    }

    return updated;
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
