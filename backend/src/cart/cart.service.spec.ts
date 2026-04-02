import { Test, TestingModule } from '@nestjs/testing';
import { CartService } from './cart.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('CartService', () => {
  let service: CartService;
  let cacheManager: any;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            product: {
              findUnique: jest.fn(),
            },
            productVariation: {
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
    cacheManager = module.get(CACHE_MANAGER);
    prisma = module.get<PrismaService>(PrismaService);
  });

  const userId = 'user1';
  const mockProduct = {
    id: 'prod1',
    name: 'Warrior',
    basePrice: 49.9,
    isActive: true,
  };

  describe('getCart', () => {
    it('should return empty cart when nothing in cache', async () => {
      cacheManager.get.mockResolvedValue(null);

      const result = await service.getCart(userId);

      expect(result.items).toEqual([]);
      expect(result.subtotal).toBe(0);
    });

    it('should return cart from cache', async () => {
      const cartData = {
        items: [
          { productId: 'prod1', quantity: 2, price: 49.9, name: 'Warrior' },
        ],
      };
      cacheManager.get.mockResolvedValue(JSON.stringify(cartData));

      const result = await service.getCart(userId);

      expect(result.items).toHaveLength(1);
      expect(result.subtotal).toBe(99.8);
    });
  });

  describe('addItem', () => {
    it('should add item to empty cart', async () => {
      cacheManager.get.mockResolvedValue(null);
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);
      cacheManager.set.mockResolvedValue(undefined);

      const result = await service.addItem(userId, {
        productId: 'prod1',
        quantity: 1,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].productId).toBe('prod1');
      expect(cacheManager.set).toHaveBeenCalled();
    });

    it('should increase quantity if product already in cart', async () => {
      const existingCart = {
        items: [
          { productId: 'prod1', quantity: 1, price: 49.9, name: 'Warrior' },
        ],
      };
      cacheManager.get.mockResolvedValue(JSON.stringify(existingCart));
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);
      cacheManager.set.mockResolvedValue(undefined);

      const result = await service.addItem(userId, {
        productId: 'prod1',
        quantity: 2,
      });

      expect(result.items[0].quantity).toBe(3);
    });

    it('should throw NotFoundException for non-existent product', async () => {
      cacheManager.get.mockResolvedValue(null);
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.addItem(userId, { productId: 'fake', quantity: 1 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for inactive product', async () => {
      cacheManager.get.mockResolvedValue(null);
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        ...mockProduct,
        isActive: false,
      });

      await expect(
        service.addItem(userId, { productId: 'prod1', quantity: 1 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeItem', () => {
    it('should remove item from cart', async () => {
      const cart = {
        items: [
          { productId: 'prod1', quantity: 2, price: 49.9, name: 'Warrior' },
          { productId: 'prod2', quantity: 1, price: 29.9, name: 'Mage' },
        ],
      };
      cacheManager.get.mockResolvedValue(JSON.stringify(cart));
      cacheManager.set.mockResolvedValue(undefined);

      const result = await service.removeItem(userId, 'prod1');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].productId).toBe('prod2');
    });
  });

  describe('clear', () => {
    it('should delete cart from cache', async () => {
      cacheManager.del.mockResolvedValue(undefined);

      await service.clear(userId);

      expect(cacheManager.del).toHaveBeenCalledWith(`cart:${userId}`);
    });
  });
});
