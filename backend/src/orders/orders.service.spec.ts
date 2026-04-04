import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../stock/stock.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: PrismaService;

  const mockStockService = {
    reserveStock: jest.fn().mockResolvedValue(undefined),
    releaseStock: jest.fn().mockResolvedValue(undefined),
    confirmReservation: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
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
            product: {
              findUnique: jest.fn(),
            },
            orderStatusHistory: {
              create: jest.fn(),
            },
          },
        },
        {
          provide: StockService,
          useValue: mockStockService,
        },
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
    it('should create order with generated order number', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'prod1',
        basePrice: 49.9,
        salePrice: null,
        isActive: true,
        manageStock: false,
        variations: [],
      });
      (prisma.order.create as jest.Mock).mockImplementation(async (args: any) => ({
        id: 'order1',
        number: 'ORD-20260402-ABC123',
        status: 'PENDING',
        ...args.data,
      }));

      const result = await service.createOrder({
        userId: 'user1',
        items: [{ productId: 'prod1', quantity: 2, price: 49.9 }],
        subtotal: 99.8,
        total: 99.8,
      });

      expect(result).toHaveProperty('number');
      expect(result.status).toBe('PENDING');
      expect(result.subtotal).toBe(99.8); // recalculado do banco
    });

    it('should recalculate prices from DB — ignore frontend prices', async () => {
      // Produto no banco custa R$50, mas frontend envia R$1
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'prod1',
        basePrice: 50,
        salePrice: null,
        isActive: true,
        manageStock: false,
      });

      (prisma.order.create as jest.Mock).mockImplementation(async (args: any) => ({
        id: 'order1',
        number: 'ORD-20260404-SEC1',
        status: 'PENDING',
        ...args.data,
      }));

      const result = await service.createOrder({
        userId: 'user1',
        items: [{ productId: 'prod1', quantity: 2, price: 1 }], // Atacante envia price: 1
        subtotal: 2, // Atacante envia subtotal falso
        total: 2, // Atacante envia total falso
      });

      // Backend deve usar preço do banco (R$50), não do frontend (R$1)
      expect(result.subtotal).toBe(100); // 50 * 2
      expect(result.total).toBe(100); // recalculado
    });

    it('should use salePrice when available (promotional price)', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'prod1',
        basePrice: 100,
        salePrice: 79.9,
        isActive: true,
        manageStock: false,
      });

      (prisma.order.create as jest.Mock).mockImplementation(async (args: any) => ({
        id: 'order1',
        number: 'ORD-20260404-SALE',
        status: 'PENDING',
        ...args.data,
      }));

      const result = await service.createOrder({
        userId: 'user1',
        items: [{ productId: 'prod1', quantity: 1, price: 100 }],
        subtotal: 100,
        total: 100,
      });

      expect(result.subtotal).toBe(79.9); // usa salePrice
    });

    it('should use variation price when variationId is provided', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'prod1',
        basePrice: 0,
        salePrice: null,
        isActive: true,
        manageStock: false,
        variations: [
          { id: 'var1', price: 69.9, salePrice: 59.9, stock: 10 },
        ],
      });

      (prisma.order.create as jest.Mock).mockImplementation(async (args: any) => ({
        id: 'order1',
        number: 'ORD-20260404-VAR',
        status: 'PENDING',
        ...args.data,
      }));

      const result = await service.createOrder({
        userId: 'user1',
        items: [{ productId: 'prod1', variationId: 'var1', quantity: 1, price: 1 }],
        subtotal: 1,
        total: 1,
      });

      expect(result.subtotal).toBe(59.9); // variation salePrice
    });

    it('should throw when product is inactive', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'prod1',
        basePrice: 50,
        isActive: false,
      });

      await expect(
        service.createOrder({
          userId: 'user1',
          items: [{ productId: 'prod1', quantity: 1, price: 50 }],
          subtotal: 50,
          total: 50,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when product does not exist', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createOrder({
          userId: 'user1',
          items: [{ productId: 'fake', quantity: 1, price: 50 }],
          subtotal: 50,
          total: 50,
        }),
      ).rejects.toThrow(BadRequestException);
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

      const result = await service.updateStatus(
        'order1',
        'CONFIRMED',
        'admin1',
      );

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
  });

  describe('findAll', () => {
    it('should return paginated orders', async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.order.count as jest.Mock).mockResolvedValue(0);

      const result = await service.findAll({
        page: 1,
        perPage: 10,
        userId: 'user1',
      });

      expect(result.meta).toHaveProperty('total', 0);
      expect(result.meta).toHaveProperty('page', 1);
    });
  });
});
