import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

describe('ReviewsService', () => {
  let service: ReviewsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        {
          provide: PrismaService,
          useValue: {
            review: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              count: jest.fn(),
              aggregate: jest.fn(),
            },
            order: {
              findUnique: jest.fn(),
            },
            coupon: {
              create: jest.fn(),
            },
            reviewReward: {
              create: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('create', () => {
    it('should create review for DELIVERED order', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order1',
        userId: 'user1',
        status: 'DELIVERED',
        items: [{ productId: 'prod1' }],
      });
      (prisma.review.create as jest.Mock).mockResolvedValue({
        id: 'rev1',
        productId: 'prod1',
        userId: 'user1',
        orderId: 'order1',
        rating: 5,
        comment: 'Excelente!',
      });

      const result = await service.create({
        userId: 'user1',
        productId: 'prod1',
        orderId: 'order1',
        rating: 5,
        comment: 'Excelente!',
      });

      expect(result.rating).toBe(5);
    });

    it('should reject review if order is NOT DELIVERED', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order1',
        userId: 'user1',
        status: 'PROCESSING',
        items: [{ productId: 'prod1' }],
      });

      await expect(
        service.create({
          userId: 'user1',
          productId: 'prod1',
          orderId: 'order1',
          rating: 5,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject review if order does not belong to user', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order1',
        userId: 'other-user',
        status: 'DELIVERED',
        items: [{ productId: 'prod1' }],
      });

      await expect(
        service.create({
          userId: 'user1',
          productId: 'prod1',
          orderId: 'order1',
          rating: 5,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject review if product was not in the order', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order1',
        userId: 'user1',
        status: 'DELIVERED',
        items: [{ productId: 'other-product' }],
      });

      await expect(
        service.create({
          userId: 'user1',
          productId: 'prod1',
          orderId: 'order1',
          rating: 5,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject rating outside 1-5', async () => {
      await expect(
        service.create({
          userId: 'user1',
          productId: 'prod1',
          orderId: 'order1',
          rating: 6,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findByProduct', () => {
    it('should return only approved reviews', async () => {
      (prisma.review.findMany as jest.Mock).mockResolvedValue([
        { id: 'rev1', rating: 5, comment: 'Top', user: { name: 'João' } },
      ]);

      const result = await service.findByProduct('prod1');

      expect(prisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { productId: 'prod1', isApproved: true },
        }),
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('getAverageRating', () => {
    it('should return average rating for a product', async () => {
      (prisma.review.aggregate as jest.Mock).mockResolvedValue({
        _avg: { rating: 4.5 },
        _count: { rating: 10 },
      });

      const result = await service.getAverageRating('prod1');

      expect(result.average).toBe(4.5);
      expect(result.count).toBe(10);
    });

    it('should return 0 if no reviews', async () => {
      (prisma.review.aggregate as jest.Mock).mockResolvedValue({
        _avg: { rating: null },
        _count: { rating: 0 },
      });

      const result = await service.getAverageRating('prod1');

      expect(result.average).toBe(0);
      expect(result.count).toBe(0);
    });
  });

  describe('approve', () => {
    it('should set isApproved to true', async () => {
      (prisma.review.update as jest.Mock).mockResolvedValue({
        id: 'rev1',
        isApproved: true,
      });

      const result = await service.approve('rev1');

      expect(prisma.review.update).toHaveBeenCalledWith({
        where: { id: 'rev1' },
        data: { isApproved: true },
      });
      expect(result.isApproved).toBe(true);
    });
  });

  describe('generateReward', () => {
    it('should create coupon and link to review', async () => {
      (prisma.coupon.create as jest.Mock).mockResolvedValue({
        id: 'coupon1',
        code: expect.any(String),
      });
      (prisma.reviewReward.create as jest.Mock).mockResolvedValue({
        id: 'rr1',
        reviewId: 'rev1',
        couponId: 'coupon1',
      });

      const result = await service.generateReward('rev1', 'user1');

      expect(prisma.coupon.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'PERCENTAGE',
          value: 5,
          usesPerUser: 1,
          isActive: true,
        }),
      });
      expect(result.couponId).toBe('coupon1');
    });
  });
});
