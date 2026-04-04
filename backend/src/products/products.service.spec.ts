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
            productImage: {
              deleteMany: jest.fn(),
              createMany: jest.fn(),
            },
            productVariation: {
              findMany: jest.fn(),
              deleteMany: jest.fn(),
              createMany: jest.fn(),
              update: jest.fn(),
            },
            stockAuditLog: {
              create: jest.fn(),
              findMany: jest.fn().mockResolvedValue([]),
              deleteMany: jest.fn(),
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

    it('should filter by attribute values', async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.product.count as jest.Mock).mockResolvedValue(0);

      await service.findAll({
        page: 1,
        perPage: 10,
        attributeValueIds: ['av1', 'av2'],
      });

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            attributes: {
              some: { attributeValueId: { in: ['av1', 'av2'] } },
            },
          }),
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

  describe('resolveShippingData', () => {
    const mockVariableProduct = {
      ...mockProduct,
      type: 'variable',
      basePrice: 0,
      weight: 0.5,
      width: 15,
      height: 10,
      length: 20,
      variations: [
        {
          id: 'var1',
          name: '28mm',
          price: 49.9,
          salePrice: 39.9,
          weight: 0.8,
          width: 20,
          height: 15,
          length: 25,
        },
        {
          id: 'var2',
          name: '32mm',
          price: 69.9,
          salePrice: null,
          weight: null,
          width: null,
          height: null,
          length: null,
        },
      ],
    };

    it('should use variation weight/dimensions when provided', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(mockVariableProduct);

      const data = await service.resolveShippingData('prod1', 'var1');

      expect(data.weight).toBe(0.8);
      expect(data.width).toBe(20);
      expect(data.height).toBe(15);
      expect(data.length).toBe(25);
    });

    it('should fallback to parent weight/dimensions when variation has null', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(mockVariableProduct);

      const data = await service.resolveShippingData('prod1', 'var2');

      expect(data.weight).toBe(0.5); // parent
      expect(data.width).toBe(15);   // parent
      expect(data.height).toBe(10);  // parent
      expect(data.length).toBe(20);  // parent
    });

    it('should use variation salePrice when available', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(mockVariableProduct);

      const data = await service.resolveShippingData('prod1', 'var1');

      expect(data.price).toBe(39.9); // salePrice
    });

    it('should use variation price when no salePrice', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(mockVariableProduct);

      const data = await service.resolveShippingData('prod1', 'var2');

      expect(data.price).toBe(69.9); // regular price
    });

    it('should use parent product data when no variationId', async () => {
      const simpleProduct = {
        ...mockProduct,
        type: 'simple',
        weight: 0.4,
        width: 12,
        height: 8,
        length: 18,
        salePrice: 39.9,
        variations: [],
      };
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(simpleProduct);

      const data = await service.resolveShippingData('prod1');

      expect(data.weight).toBe(0.4);
      expect(data.width).toBe(12);
      expect(data.height).toBe(8);
      expect(data.length).toBe(18);
      expect(data.price).toBe(39.9); // salePrice
    });

    it('should throw when variationId does not belong to product', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(mockVariableProduct);

      await expect(
        service.resolveShippingData('prod1', 'var-nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create with variations', () => {
    it('should create product and its variations', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.product.create as jest.Mock).mockResolvedValue({
        ...mockProduct,
        id: 'prod-new',
        type: 'variable',
      });
      (prisma.productVariation.createMany as jest.Mock).mockResolvedValue({ count: 2 });

      await service.create({
        name: 'Variable Product',
        description: 'Has variations',
        basePrice: 0,
        type: 'variable',
        variations: [
          { name: '28mm', price: 49.9, stock: 10 },
          { name: '32mm', price: 69.9, stock: 5, sku: 'VAR-32' },
        ],
      });

      expect(prisma.productVariation.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ productId: 'prod-new', name: '28mm', price: 49.9, stock: 10 }),
          expect.objectContaining({ productId: 'prod-new', name: '32mm', price: 69.9, stock: 5, sku: 'VAR-32' }),
        ],
      });
    });
  });

  describe('update stock creates audit log', () => {
    it('should create audit log when stock changes via product form', async () => {
      // Current product state
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        ...mockProduct,
        stock: 50,
      });
      (prisma.product.update as jest.Mock).mockResolvedValue({
        ...mockProduct,
        stock: 30,
      });
      (prisma.stockAuditLog.create as jest.Mock).mockResolvedValue({});
      (prisma.stockAuditLog.findMany as jest.Mock).mockResolvedValue([]);

      await service.update('prod1', { stock: 30 }, 'admin1');

      expect(prisma.stockAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          productId: 'prod1',
          quantityBefore: 50,
          quantityAfter: 30,
          delta: -20,
          reason: 'ADMIN_ADJUSTMENT',
          referenceId: 'admin1',
        }),
      });
    });

    it('should NOT create audit log when stock does not change', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        ...mockProduct,
        stock: 50,
      });
      (prisma.product.update as jest.Mock).mockResolvedValue(mockProduct);

      await service.update('prod1', { name: 'Renamed' }, 'admin1');

      expect(prisma.stockAuditLog.create).not.toHaveBeenCalled();
    });
  });

  describe('update with variations', () => {
    it('should upsert variations: update existing, create new, delete removed', async () => {
      // Existing variations in DB
      (prisma.productVariation.findMany as jest.Mock).mockResolvedValue([
        { id: 'v1', productId: 'prod1', name: '28mm', price: 49.9, stock: 10 },
        { id: 'v2', productId: 'prod1', name: '32mm', price: 69.9, stock: 5 },
      ]);
      (prisma.productVariation.update as jest.Mock).mockResolvedValue({});
      (prisma.productVariation.createMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.productVariation.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.product.update as jest.Mock).mockResolvedValue(mockProduct);

      await service.update('prod1', {
        variations: [
          { id: 'v1', name: '28mm', price: 59.9, stock: 15 }, // update existing
          // v2 removed
          { name: '75mm', price: 99.9, stock: 3 }, // new
        ],
      });

      // Should update v1
      expect(prisma.productVariation.update).toHaveBeenCalledWith({
        where: { id: 'v1' },
        data: expect.objectContaining({ name: '28mm', price: 59.9, stock: 15 }),
      });

      // Should delete v2 (not in new list)
      expect(prisma.productVariation.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['v2'] } },
      });

      // Should create new 75mm
      expect(prisma.productVariation.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ productId: 'prod1', name: '75mm', price: 99.9, stock: 3 }),
        ],
      });
    });
  });
});
