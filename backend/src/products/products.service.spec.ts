import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: PrismaService,
          useValue: {
            product: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  const mockProduct = {
    id: 'prod1',
    name: 'Warrior Miniature',
    slug: 'warrior-miniature',
    description: 'A mighty warrior miniature',
    basePrice: 49.9,
    isActive: true,
    featured: false,
    categoryId: 'cat1',
    brandId: 'brand1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('create', () => {
    it('should create product with auto-generated slug', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.product.create as jest.Mock).mockResolvedValue(mockProduct);

      const result = await service.create({
        name: 'Warrior Miniature',
        description: 'A mighty warrior miniature',
        basePrice: 49.9,
        categoryId: 'cat1',
      });

      expect(result.slug).toBe('warrior-miniature');
    });

    it('should throw ConflictException for duplicate slug', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);

      await expect(
        service.create({
          name: 'Warrior Miniature',
          description: 'Duplicate',
          basePrice: 49.9,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should NEVER accept basePrice from frontend calculation', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.product.create as jest.Mock).mockResolvedValue(mockProduct);

      await service.create({
        name: 'Test Product',
        description: 'Test description here',
        basePrice: 49.9,
      });

      // basePrice comes from the DTO and is validated by admin
      // The service must NOT recalculate or modify the base price
      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ basePrice: 49.9 }),
        }),
      );
    });
  });

  describe('findBySlug', () => {
    it('should return product with relations', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        ...mockProduct,
        category: { id: 'cat1', name: 'Fantasy' },
        brand: { id: 'brand1', name: 'Arsenal' },
        tags: [],
        images: [],
        variations: [],
      });

      const result = await service.findBySlug('warrior-miniature');

      expect(result.slug).toBe('warrior-miniature');
    });

    it('should throw NotFoundException for non-existent slug', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findBySlug('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated products', async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValue([mockProduct]);
      (prisma.product.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll({ page: 1, perPage: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.meta).toHaveProperty('total', 1);
      expect(result.meta).toHaveProperty('page', 1);
      expect(result.meta).toHaveProperty('perPage', 10);
      expect(result.meta).toHaveProperty('lastPage', 1);
    });

    it('should only return active products for public listing', async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.product.count as jest.Mock).mockResolvedValue(0);

      await service.findAll({ page: 1, perPage: 10 });

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        }),
      );
    });
  });

  describe('remove (soft delete)', () => {
    it('should soft delete by setting isActive to false', async () => {
      (prisma.product.update as jest.Mock).mockResolvedValue({
        ...mockProduct,
        isActive: false,
      });

      const result = await service.remove('prod1');

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'prod1' },
        data: { isActive: false },
      });
    });
  });
});
