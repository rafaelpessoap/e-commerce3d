import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../stock/stock.service';
import { PricingService } from '../pricing/pricing.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: PrismaService;
  let pricingService: any;

  const mockStockService = {
    reserveStock: jest.fn().mockResolvedValue(undefined),
    releaseStock: jest.fn().mockResolvedValue(undefined),
    confirmReservation: jest.fn().mockResolvedValue(undefined),
  };

  const mockPricingResult = {
    items: [
      {
        productId: 'prod1',
        variationId: undefined,
        scaleId: undefined,
        quantity: 2,
        basePrice: 49.9,
        scalePercentage: 0,
        unitPrice: 49.9,
        lineTotal: 99.8,
      },
    ],
    subtotal: 99.8,
    couponDiscount: 0,
    couponId: undefined,
    isFreeShipping: false,
    shipping: 0,
    paymentDiscount: 0,
    total: 99.8,
  };

  beforeEach(async () => {
    pricingService = {
      calculateOrderPricing: jest.fn().mockResolvedValue(mockPricingResult),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: PrismaService,
          useValue: {
            order: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              count: jest.fn(),
            },
            orderStatusHistory: {
              create: jest.fn(),
            },
          },
        },
        { provide: StockService, useValue: mockStockService },
        { provide: PricingService, useValue: pricingService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('status machine transitions', () => {
    it('should allow PENDING → CONFIRMED', () => {
      expect(service.isValidTransition('PENDING', 'CONFIRMED')).toBe(true);
    });

    it('should allow CONFIRMED → PROCESSING', () => {
      expect(service.isValidTransition('CONFIRMED', 'PROCESSING')).toBe(true);
    });

    it('should allow PROCESSING → SHIPPED', () => {
      expect(service.isValidTransition('PROCESSING', 'SHIPPED')).toBe(true);
    });

    it('should allow SHIPPED → DELIVERED', () => {
      expect(service.isValidTransition('SHIPPED', 'DELIVERED')).toBe(true);
    });

    it('should NOT allow DELIVERED → PENDING', () => {
      expect(service.isValidTransition('DELIVERED', 'PENDING')).toBe(false);
    });

    it('should NOT allow PROCESSING → PENDING', () => {
      expect(service.isValidTransition('PROCESSING', 'PENDING')).toBe(false);
    });

    it('should allow CANCELLED from any non-terminal state', () => {
      expect(service.isValidTransition('PENDING', 'CANCELLED')).toBe(true);
      expect(service.isValidTransition('CONFIRMED', 'CANCELLED')).toBe(true);
      expect(service.isValidTransition('PROCESSING', 'CANCELLED')).toBe(true);
    });

    it('should NOT allow CANCELLED from DELIVERED', () => {
      expect(service.isValidTransition('DELIVERED', 'CANCELLED')).toBe(false);
    });
  });

  describe('createOrder', () => {
    it('should delegate pricing to PricingService and create order', async () => {
      (prisma.order.create as jest.Mock).mockImplementation(async (args: any) => ({
        id: 'order1',
        number: 'ORD-20260405-ABC',
        status: 'PENDING',
        ...args.data,
      }));

      const result = await service.createOrder({
        userId: 'user1',
        items: [{ productId: 'prod1', quantity: 2 }],
      });

      expect(pricingService.calculateOrderPricing).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user1',
          items: [{ productId: 'prod1', quantity: 2 }],
        }),
      );
      expect(result.subtotal).toBe(99.8);
      expect(result.status).toBe('PENDING');
    });

    it('should pass scaleId and couponCode to PricingService', async () => {
      (prisma.order.create as jest.Mock).mockImplementation(async (args: any) => ({
        id: 'order1',
        number: 'ORD-20260405-SC',
        status: 'PENDING',
        ...args.data,
      }));

      await service.createOrder({
        userId: 'user1',
        items: [{ productId: 'prod1', variationId: 'v1', scaleId: 'item2', quantity: 1 }],
        couponCode: 'DESC10',
        shipping: 15,
        paymentMethod: 'pix',
      });

      expect(pricingService.calculateOrderPricing).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [{ productId: 'prod1', variationId: 'v1', scaleId: 'item2', quantity: 1 }],
          couponCode: 'DESC10',
          shippingAmount: 15,
          paymentMethod: 'pix',
        }),
      );
    });

    it('should store coupon discount from PricingService', async () => {
      pricingService.calculateOrderPricing.mockResolvedValue({
        ...mockPricingResult,
        subtotal: 100,
        couponDiscount: 10,
        couponId: 'c1',
        shipping: 15,
        total: 105, // 100 - 10 + 15
      });

      (prisma.order.create as jest.Mock).mockImplementation(async (args: any) => ({
        id: 'order1',
        ...args.data,
      }));

      const result = await service.createOrder({
        userId: 'user1',
        items: [{ productId: 'prod1', quantity: 1 }],
        couponCode: 'DESC10',
        shipping: 15,
      });

      expect(result.discount).toBe(10);
      expect(result.couponId).toBe('c1');
      expect(result.total).toBe(105);
    });

    it('should propagate PricingService errors (inactive product)', async () => {
      pricingService.calculateOrderPricing.mockRejectedValue(
        new BadRequestException('Product is not available'),
      );

      await expect(
        service.createOrder({
          userId: 'user1',
          items: [{ productId: 'prod1', quantity: 1 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should propagate PricingService errors (product not found)', async () => {
      pricingService.calculateOrderPricing.mockRejectedValue(
        new NotFoundException('Product not found'),
      );

      await expect(
        service.createOrder({
          userId: 'user1',
          items: [{ productId: 'fake', quantity: 1 }],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reserve stock after creating order', async () => {
      (prisma.order.create as jest.Mock).mockImplementation(async (args: any) => ({
        id: 'order1',
        ...args.data,
      }));

      await service.createOrder({
        userId: 'user1',
        items: [{ productId: 'prod1', quantity: 2 }],
      });

      expect(mockStockService.reserveStock).toHaveBeenCalledWith(
        'order1',
        [{ productId: 'prod1', variationId: undefined, quantity: 2 }],
      );
    });
  });

  describe('updateStatus', () => {
    it('should update status with valid transition and record history', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order1',
        status: 'PENDING',
      });
      (prisma.order.update as jest.Mock).mockResolvedValue({
        id: 'order1',
        status: 'CONFIRMED',
      });
      (prisma.orderStatusHistory.create as jest.Mock).mockResolvedValue({});

      const result = await service.updateStatus('order1', 'CONFIRMED', 'admin1');

      expect(result.status).toBe('CONFIRMED');
      expect(prisma.orderStatusHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderId: 'order1',
          fromStatus: 'PENDING',
          toStatus: 'CONFIRMED',
          createdBy: 'admin1',
        }),
      });
    });

    it('should throw BadRequestException for invalid transition', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order1',
        status: 'DELIVERED',
      });

      await expect(
        service.updateStatus('order1', 'PENDING', 'admin1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for non-existent order', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateStatus('fake', 'CONFIRMED', 'admin1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should release stock on CANCELLED', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order1',
        status: 'PENDING',
      });
      (prisma.order.update as jest.Mock).mockResolvedValue({
        id: 'order1',
        status: 'CANCELLED',
      });
      (prisma.orderStatusHistory.create as jest.Mock).mockResolvedValue({});

      await service.updateStatus('order1', 'CANCELLED', 'admin1');

      expect(mockStockService.releaseStock).toHaveBeenCalledWith(
        'order1',
        'ORDER_CANCELLED',
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated orders', async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.order.count as jest.Mock).mockResolvedValue(0);

      const result = await service.findAll({ page: 1, perPage: 10, userId: 'user1' });

      expect(result.meta).toHaveProperty('total', 0);
      expect(result.meta).toHaveProperty('page', 1);
    });
  });
});
