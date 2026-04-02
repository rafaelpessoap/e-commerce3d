import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: PrismaService;

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
            orderStatusHistory: {
              create: jest.fn(),
            },
          },
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
      (prisma.order.create as jest.Mock).mockResolvedValue({
        id: 'order1',
        number: 'ORD-20260402-ABC123',
        status: 'PENDING',
        userId: 'user1',
        subtotal: 99.8,
        total: 99.8,
      });

      const result = await service.createOrder({
        userId: 'user1',
        items: [{ productId: 'prod1', quantity: 2, price: 49.9 }],
        subtotal: 99.8,
        total: 99.8,
      });

      expect(result).toHaveProperty('number');
      expect(result.status).toBe('PENDING');
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
