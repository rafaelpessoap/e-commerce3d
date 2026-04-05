import { Test, TestingModule } from '@nestjs/testing';
import { CartService } from './cart.service';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { ScalesService } from '../scales/scales.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('CartService', () => {
  let service: CartService;
  let redis: RedisService;
  let prisma: PrismaService;
  let scalesService: ScalesService;

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
            productVariation: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: ScalesService,
          useValue: {
            resolveScaleRule: jest.fn(),
            calculateScalePrice: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
    redis = module.get<RedisService>(RedisService);
    prisma = module.get<PrismaService>(PrismaService);
    scalesService = module.get<ScalesService>(ScalesService);
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

  describe('addItem with variation', () => {
    it('should use variation price and name when variationId provided', async () => {
      (redis.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        ...mockProduct,
        type: 'variable',
        basePrice: 0,
      });
      (prisma.productVariation.findUnique as jest.Mock).mockResolvedValue({
        id: 'var1',
        name: 'Modelo A',
        price: 79,
        salePrice: null,
        image: 'https://cdn/img.webp',
      });
      (scalesService.resolveScaleRule as jest.Mock).mockResolvedValue(null);

      const result = await service.addItem(userId, {
        productId: 'prod1',
        variationId: 'var1',
        quantity: 1,
      });

      expect(result.items[0].price).toBe(79);
      expect(result.items[0].variationName).toBe('Modelo A');
      expect(result.items[0].image).toBe('https://cdn/img.webp');
    });
  });

  describe('addItem with scale', () => {
    it('should apply scale percentage increase to price (scaleId = ScaleRuleItem.id)', async () => {
      (redis.getJson as jest.Mock).mockResolvedValue(null);
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);
      (scalesService.resolveScaleRule as jest.Mock).mockResolvedValue({
        id: 'rs1',
        name: 'Miniaturas Padrao',
        items: [
          { id: 'item1', name: '28mm', percentageIncrease: 0, sortOrder: 0 },
          { id: 'item2', name: '32mm', percentageIncrease: 15, sortOrder: 1 },
        ],
      });
      (scalesService.calculateScalePrice as jest.Mock).mockReturnValue(57.39);

      const result = await service.addItem(userId, {
        productId: 'prod1',
        scaleId: 'item2', // ScaleRuleItem.id
        quantity: 1,
      });

      expect(result.items[0].price).toBe(57.39);
      expect(result.items[0].scaleName).toBe('32mm');
      expect(result.items[0].scaleId).toBe('item2');
      expect(scalesService.calculateScalePrice).toHaveBeenCalledWith(49.9, 15);
    });

    it('should treat same product with different scales as separate items', async () => {
      const existingCart = {
        items: [
          { productId: 'prod1', scaleId: 'item1', quantity: 1, price: 49.9, name: 'Warrior', scaleName: '28mm' },
        ],
      };
      (redis.getJson as jest.Mock).mockResolvedValue(existingCart);
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);
      (scalesService.resolveScaleRule as jest.Mock).mockResolvedValue({
        id: 'rs1',
        items: [
          { id: 'item2', name: '32mm', percentageIncrease: 15, sortOrder: 1 },
        ],
      });
      (scalesService.calculateScalePrice as jest.Mock).mockReturnValue(57.39);

      const result = await service.addItem(userId, {
        productId: 'prod1',
        scaleId: 'item2',
        quantity: 1,
      });

      expect(result.items).toHaveLength(2);
    });
  });

  describe('removeItem with composite key', () => {
    it('should remove by productId + variationId + scaleId', async () => {
      const cart = {
        items: [
          { productId: 'prod1', variationId: 'v1', scaleId: 's1', quantity: 1, price: 49.9, name: 'A' },
          { productId: 'prod1', variationId: 'v1', scaleId: 's2', quantity: 1, price: 57.39, name: 'A' },
        ],
      };
      (redis.getJson as jest.Mock).mockResolvedValue(cart);

      const result = await service.removeItem(userId, 'prod1', 'v1', 's2');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].scaleId).toBe('s1');
    });
  });

  describe('updateQuantity with composite key', () => {
    it('should update by productId + variationId + scaleId', async () => {
      const cart = {
        items: [
          { productId: 'prod1', variationId: 'v1', scaleId: 's1', quantity: 1, price: 49.9, name: 'A' },
          { productId: 'prod1', variationId: 'v1', scaleId: 's2', quantity: 1, price: 57.39, name: 'A' },
        ],
      };
      (redis.getJson as jest.Mock).mockResolvedValue(cart);

      const result = await service.updateQuantity(userId, 'prod1', 5, 'v1', 's2');

      expect(result.items[1].quantity).toBe(5);
      expect(result.items[0].quantity).toBe(1); // untouched
    });
  });
});
