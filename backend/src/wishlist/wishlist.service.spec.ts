import { Test, TestingModule } from '@nestjs/testing';
import { WishlistService } from './wishlist.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictException } from '@nestjs/common';

describe('WishlistService', () => {
  let service: WishlistService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WishlistService,
        {
          provide: PrismaService,
          useValue: {
            wishlistItem: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<WishlistService>(WishlistService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('findAll', () => {
    it('should return wishlist items with product data', async () => {
      (prisma.wishlistItem.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'w1',
          userId: 'user1',
          productId: 'prod1',
          product: { id: 'prod1', name: 'Warrior', basePrice: 49.9 },
        },
      ]);

      const result = await service.findAll('user1');

      expect(result).toHaveLength(1);
      expect(result[0].product.name).toBe('Warrior');
    });
  });

  describe('add', () => {
    it('should add product to wishlist', async () => {
      (prisma.wishlistItem.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.wishlistItem.create as jest.Mock).mockResolvedValue({
        id: 'w1',
        userId: 'user1',
        productId: 'prod1',
      });

      const result = await service.add('user1', 'prod1');

      expect(result.productId).toBe('prod1');
    });

    it('should throw ConflictException if already in wishlist', async () => {
      (prisma.wishlistItem.findUnique as jest.Mock).mockResolvedValue({
        id: 'w1',
        userId: 'user1',
        productId: 'prod1',
      });

      await expect(service.add('user1', 'prod1')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('remove', () => {
    it('should remove product from wishlist', async () => {
      (prisma.wishlistItem.delete as jest.Mock).mockResolvedValue({});

      await service.remove('user1', 'prod1');

      expect(prisma.wishlistItem.delete).toHaveBeenCalledWith({
        where: { userId_productId: { userId: 'user1', productId: 'prod1' } },
      });
    });
  });
});
