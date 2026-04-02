import { Test, TestingModule } from '@nestjs/testing';
import { CartService } from './cart.service';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('CartService', () => {
  let service: CartService;
  let redis: RedisService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        {
          provide: RedisService,
          useValue: {
            getJson: jest.fn(),
            setJson: jest.fn(),
            del: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            product: {
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
    redis = module.get<RedisService>(RedisService);
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
    it('should return empty cart when nothing in Redis', async () => {
      (redis.getJson as jest.Mock).mockResolvedValue(null);

      const result = await service.getCart(userId);

      expect(result.items).toEqual([]);
      expect(result.subtotal).toBe(0);
    });

    it('should return cart from Redis', async () => {
      const cartData = {
        items: [
          { productId: 'prod1', quantity: 2, price: 49.9, name: 'Warrior' },
        ],
      };
      (redis.getJson as jest.Mock).mockResolvedValue(cartData);

      const result = await service.getCart(userId);

      expect(result.items).toHaveLength(1);
      expect(result.subtotal).toBe(99.8);
    });
  });

  describe('addItem', () => {
    it('should add item to empty cart and save to Redis with TTL', async () => {
      (redis.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);

      const result = await service.addItem(userId, {
        productId: 'prod1',
        quantity: 1,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].productId).toBe('prod1');
      expect(redis.setJson).toHaveBeenCalledWith(
        'cart:user1',
        expect.objectContaining({ items: expect.any(Array) }),
        7 * 24 * 60 * 60, // 7 days in seconds
      );
    });

    it('should increase quantity if product already in cart', async () => {
      const existingCart = {
        items: [
          { productId: 'prod1', quantity: 1, price: 49.9, name: 'Warrior' },
        ],
      };
      (redis.getJson as jest.Mock).mockResolvedValue(existingCart);
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);

      const result = await service.addItem(userId, {
        productId: 'prod1',
        quantity: 2,
      });

      expect(result.items[0].quantity).toBe(3);
    });

    it('should throw NotFoundException for non-existent product', async () => {
      (redis.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.addItem(userId, { productId: 'fake', quantity: 1 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for inactive product', async () => {
      (redis.getJson as jest.Mock).mockResolvedValue(null);
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
      (redis.getJson as jest.Mock).mockResolvedValue(cart);

      const result = await service.removeItem(userId, 'prod1');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].productId).toBe('prod2');
    });
  });

  describe('clear', () => {
    it('should delete cart from Redis', async () => {
      await service.clear(userId);

      expect(redis.del).toHaveBeenCalledWith('cart:user1');
    });
  });
});
