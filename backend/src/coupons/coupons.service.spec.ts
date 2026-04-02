import { Test, TestingModule } from '@nestjs/testing';
import { CouponsService } from './coupons.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('CouponsService', () => {
  let service: CouponsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponsService,
        {
          provide: PrismaService,
          useValue: {
            coupon: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            couponUsage: {
              count: jest.fn(),
            },
            order: {
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<CouponsService>(CouponsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  const now = new Date();
  const mockCoupon = {
    id: 'coupon1',
    code: 'WELCOME10',
    type: 'PERCENTAGE',
    value: 10,
    minOrderValue: 50,
    maxUses: 100,
    usesPerUser: 1,
    validFrom: new Date(now.getTime() - 86400000),
    validUntil: new Date(now.getTime() + 86400000),
    isFirstPurchaseOnly: false,
    isActive: true,
    _count: { usages: 5 },
  };

  describe('validate', () => {
    it('should return discount for valid PERCENTAGE coupon', async () => {
      (prisma.coupon.findUnique as jest.Mock).mockResolvedValue(mockCoupon);
      (prisma.couponUsage.count as jest.Mock).mockResolvedValue(0);

      const result = await service.validate({
        code: 'WELCOME10',
        cartValue: 100,
        userId: 'user1',
      });

      expect(result.discount).toBe(10); // 10% of 100
      expect(result.type).toBe('PERCENTAGE');
    });

    it('should return discount for valid FIXED coupon', async () => {
      (prisma.coupon.findUnique as jest.Mock).mockResolvedValue({
        ...mockCoupon,
        type: 'FIXED',
        value: 25,
      });
      (prisma.couponUsage.count as jest.Mock).mockResolvedValue(0);

      const result = await service.validate({
        code: 'WELCOME10',
        cartValue: 100,
        userId: 'user1',
      });

      expect(result.discount).toBe(25);
    });

    it('should cap FIXED discount at cart value', async () => {
      (prisma.coupon.findUnique as jest.Mock).mockResolvedValue({
        ...mockCoupon,
        type: 'FIXED',
        value: 200,
      });
      (prisma.couponUsage.count as jest.Mock).mockResolvedValue(0);

      const result = await service.validate({
        code: 'WELCOME10',
        cartValue: 100,
        userId: 'user1',
      });

      expect(result.discount).toBe(100); // capped at cartValue
    });

    it('should throw for inactive coupon', async () => {
      (prisma.coupon.findUnique as jest.Mock).mockResolvedValue({
        ...mockCoupon,
        isActive: false,
      });

      await expect(
        service.validate({ code: 'WELCOME10', cartValue: 100 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw for expired coupon', async () => {
      (prisma.coupon.findUnique as jest.Mock).mockResolvedValue({
        ...mockCoupon,
        validUntil: new Date(now.getTime() - 1000),
      });

      await expect(
        service.validate({ code: 'WELCOME10', cartValue: 100 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when cart value below minimum', async () => {
      (prisma.coupon.findUnique as jest.Mock).mockResolvedValue(mockCoupon);

      await expect(
        service.validate({ code: 'WELCOME10', cartValue: 30 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when user exceeded per-user limit', async () => {
      (prisma.coupon.findUnique as jest.Mock).mockResolvedValue(mockCoupon);
      (prisma.couponUsage.count as jest.Mock).mockResolvedValue(1); // already used once

      await expect(
        service.validate({
          code: 'WELCOME10',
          cartValue: 100,
          userId: 'user1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when max total uses exceeded', async () => {
      (prisma.coupon.findUnique as jest.Mock).mockResolvedValue({
        ...mockCoupon,
        _count: { usages: 100 },
      });
      (prisma.couponUsage.count as jest.Mock).mockResolvedValue(0);

      await expect(
        service.validate({
          code: 'WELCOME10',
          cartValue: 100,
          userId: 'user1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw for first-purchase-only coupon if user has orders', async () => {
      (prisma.coupon.findUnique as jest.Mock).mockResolvedValue({
        ...mockCoupon,
        isFirstPurchaseOnly: true,
      });
      (prisma.couponUsage.count as jest.Mock).mockResolvedValue(0);
      (prisma.order.count as jest.Mock).mockResolvedValue(3); // has previous orders

      await expect(
        service.validate({
          code: 'WELCOME10',
          cartValue: 100,
          userId: 'user1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for non-existent coupon', async () => {
      (prisma.coupon.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.validate({ code: 'INVALID', cartValue: 100 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create coupon with uppercase code', async () => {
      (prisma.coupon.create as jest.Mock).mockResolvedValue({
        ...mockCoupon,
        code: 'SUMMER20',
      });

      const result = await service.create({
        code: 'summer20',
        type: 'PERCENTAGE',
        value: 20,
      });

      expect(prisma.coupon.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ code: 'SUMMER20' }),
      });
    });
  });
});
