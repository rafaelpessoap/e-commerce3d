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
            productAttribute: {
              deleteMany: jest.fn(),
              createMany: jest.fn(),
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
    shortDescription: 'Warrior mini',
    basePrice: 49.9,
    salePrice: null,
    type: 'simple',
    isActive: true,
    featured: false,
    manageStock: true,
    stock: 50,
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
      });

      expect(result.slug).toBe('warrior-miniature');
    });

    it('should use custom slug when provided', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.product.create as jest.Mock).mockResolvedValue({
        ...mockProduct,
        slug: 'custom-slug',
      });

      const result = await service.create({
        name: 'Warrior Miniature',
        slug: 'custom-slug',
        description: 'A mighty warrior miniature',
        basePrice: 49.9,
      });

      expect(result.slug).toBe('custom-slug');
    });

    it('should throw ConflictException for duplicate slug', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);

      await expect(
        service.create({
          name: 'Warrior Miniature',
          description: 'Duplicate description here',
          basePrice: 49.9,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create product with tags and attributes', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.product.create as jest.Mock).mockResolvedValue(mockProduct);

      await service.create({
        name: 'Full Product',
        description: 'Product with all fields filled in',
        basePrice: 49.9,
        salePrice: 39.9,
        shortDescription: 'Short desc',
        type: 'variable',
        sku: 'WAR-001',
        gtin: '1234567890123',
        manageStock: true,
        stock: 50,
        weight: 0.1,
        width: 5,
        height: 8,
        length: 3,
        extraDays: 2,
        tagIds: ['tag1', 'tag2'],
        attributeValueIds: ['av1', 'av2'],
      });

      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            salePrice: 39.9,
            type: 'variable',
            gtin: '1234567890123',
            extraDays: 2,
            tags: { connect: [{ id: 'tag1' }, { id: 'tag2' }] },
            attributes: {
              create: [
                { attributeValueId: 'av1' },
                { attributeValueId: 'av2' },
              ],
            },
          }),
        }),
      );
    });
  });

  describe('findBySlug', () => {
    it('should return product with all relations', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        ...mockProduct,
        category: { id: 'cat1', name: 'Fantasy' },
        brand: { id: 'brand1', name: 'Arsenal' },
        tags: [],
        images: [],
        variations: [],
        attributes: [],
        relatedProducts: [],
      });

      const result = await service.findBySlug('warrior-miniature');

      expect(result.slug).toBe('warrior-miniature');
      expect(prisma.product.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            attributes: expect.any(Object),
            relatedProducts: true,
          }),
        }),
      );
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
      expect(result.meta).toEqual({ total: 1, page: 1, perPage: 10, lastPage: 1 });
    });

    it('should only return active products', async () => {
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

  describe('update', () => {
    it('should update product and replace attributes', async () => {
      (prisma.productAttribute.deleteMany as jest.Mock).mockResolvedValue({});
      (prisma.productAttribute.createMany as jest.Mock).mockResolvedValue({});
      (prisma.product.update as jest.Mock).mockResolvedValue({
        ...mockProduct,
        salePrice: 39.9,
      });

      await service.update('prod1', {
        salePrice: 39.9,
        attributeValueIds: ['av3', 'av4'],
      });

      // Should delete old attributes and create new ones
      expect(prisma.productAttribute.deleteMany).toHaveBeenCalledWith({
        where: { productId: 'prod1' },
      });
      expect(prisma.productAttribute.createMany).toHaveBeenCalledWith({
        data: [
          { productId: 'prod1', attributeValueId: 'av3' },
          { productId: 'prod1', attributeValueId: 'av4' },
        ],
      });
    });
  });

  describe('remove (soft delete)', () => {
    it('should soft delete by setting isActive to false', async () => {
      (prisma.product.update as jest.Mock).mockResolvedValue({
        ...mockProduct,
        isActive: false,
      });

      await service.remove('prod1');

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'prod1' },
        data: { isActive: false },
      });
    });
  });

  describe('resolveExtraDays', () => {
    it('should return product extraDays if set', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        ...mockProduct,
        extraDays: 5,
        tags: [{ extraDays: 3 }],
        category: { extraDays: 2 },
      });

      const days = await service.resolveExtraDays('prod1');
      expect(days).toBe(5);
    });

    it('should fallback to max tag extraDays', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        ...mockProduct,
        extraDays: null,
        tags: [{ extraDays: 3 }, { extraDays: 7 }, { extraDays: null }],
        category: { extraDays: 2 },
      });

      const days = await service.resolveExtraDays('prod1');
      expect(days).toBe(7);
    });

    it('should fallback to category extraDays', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        ...mockProduct,
        extraDays: null,
        tags: [{ extraDays: null }],
        category: { extraDays: 4 },
      });

      const days = await service.resolveExtraDays('prod1');
      expect(days).toBe(4);
    });

    it('should return 0 if no extraDays anywhere', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        ...mockProduct,
        extraDays: null,
        tags: [],
        category: { extraDays: null },
      });

      const days = await service.resolveExtraDays('prod1');
      expect(days).toBe(0);
    });
  });
});
