import { Test, TestingModule } from '@nestjs/testing';
import { ScalesService } from './scales.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ScalesService', () => {
  let service: ScalesService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScalesService,
        {
          provide: PrismaService,
          useValue: {
            scale: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
            },
            scaleRule: {
              findMany: jest.fn(),
              create: jest.fn(),
            },
            scaleRuleSet: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            scaleRuleItem: {
              deleteMany: jest.fn(),
              createMany: jest.fn(),
            },
            product: {
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<ScalesService>(ScalesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('create', () => {
    it('should create a scale with uppercase code', async () => {
      (prisma.scale.create as jest.Mock).mockResolvedValue({
        id: 's1',
        name: 'Heroic Scale (28mm)',
        code: 'HEROIC_28',
        baseSize: 28,
        multiplier: 1.0,
      });

      const result = await service.create({
        name: 'Heroic Scale (28mm)',
        code: 'heroic_28',
        baseSize: 28,
      });

      expect(result.code).toBe('HEROIC_28');
    });
  });

  describe('calculatePrice — HIERARQUIA DE PRIORIDADE', () => {
    it('should apply PRODUCT-level rule (highest priority)', async () => {
      (prisma.scaleRule.findMany as jest.Mock).mockResolvedValue([
        {
          appliesTo: 'PRODUCT',
          targetId: 'prod-1',
          priceMultiplier: 1.5,
          priority: 10,
        },
        {
          appliesTo: 'CATEGORY',
          targetId: 'cat-1',
          priceMultiplier: 1.2,
          priority: 5,
        },
        {
          appliesTo: 'GLOBAL',
          targetId: null,
          priceMultiplier: 1.1,
          priority: 1,
        },
      ]);

      const price = await service.calculatePrice(
        100,
        'prod-1',
        'scale-1',
        'cat-1',
      );

      expect(price).toBe(150); // 100 * 1.5
    });

    it('should apply CATEGORY-level rule when no PRODUCT rule', async () => {
      (prisma.scaleRule.findMany as jest.Mock).mockResolvedValue([
        {
          appliesTo: 'CATEGORY',
          targetId: 'cat-1',
          priceMultiplier: 1.2,
          priority: 5,
        },
        {
          appliesTo: 'GLOBAL',
          targetId: null,
          priceMultiplier: 1.1,
          priority: 1,
        },
      ]);

      const price = await service.calculatePrice(
        100,
        'prod-2',
        'scale-1',
        'cat-1',
      );

      expect(price).toBe(120); // 100 * 1.2
    });

    it('should fallback to GLOBAL rule', async () => {
      (prisma.scaleRule.findMany as jest.Mock).mockResolvedValue([
        {
          appliesTo: 'GLOBAL',
          targetId: null,
          priceMultiplier: 1.1,
          priority: 1,
        },
      ]);

      const price = await service.calculatePrice(
        100,
        'prod-3',
        'scale-1',
        'cat-1',
      );

      expect(price).toBe(110); // 100 * 1.1
    });

    it('should return base price when no rules exist', async () => {
      (prisma.scaleRule.findMany as jest.Mock).mockResolvedValue([]);

      const price = await service.calculatePrice(
        100,
        'prod-4',
        'scale-1',
        'cat-1',
      );

      expect(price).toBe(100);
    });

    it('should round to 2 decimal places', async () => {
      (prisma.scaleRule.findMany as jest.Mock).mockResolvedValue([
        {
          appliesTo: 'GLOBAL',
          targetId: null,
          priceMultiplier: 1.333,
          priority: 1,
        },
      ]);

      const price = await service.calculatePrice(
        100,
        'prod-5',
        'scale-1',
        'cat-1',
      );

      expect(price).toBe(133.3); // 100 * 1.333 = 133.3 rounded
    });
  });

  // ── Novo sistema ScaleRuleSet ──

  describe('createRuleSet', () => {
    it('should create a rule set with items', async () => {
      (prisma.scaleRuleSet.create as jest.Mock).mockResolvedValue({
        id: 'rs1',
        name: 'Miniaturas Padrao',
        items: [
          { id: 'i1', scaleId: 's1', percentageIncrease: 0 },
          { id: 'i2', scaleId: 's2', percentageIncrease: 15 },
        ],
      });

      const result = await service.createRuleSet({
        name: 'Miniaturas Padrao',
        items: [
          { scaleId: 's1', percentageIncrease: 0 },
          { scaleId: 's2', percentageIncrease: 15 },
        ],
      });

      expect(result.name).toBe('Miniaturas Padrao');
      expect(prisma.scaleRuleSet.create).toHaveBeenCalledWith({
        data: {
          name: 'Miniaturas Padrao',
          items: {
            create: [
              { scaleId: 's1', percentageIncrease: 0 },
              { scaleId: 's2', percentageIncrease: 15 },
            ],
          },
        },
        include: { items: { include: { scale: true } } },
      });
    });
  });

  describe('findAllRuleSets', () => {
    it('should return active rule sets with items', async () => {
      (prisma.scaleRuleSet.findMany as jest.Mock).mockResolvedValue([
        { id: 'rs1', name: 'Miniaturas Padrao', items: [] },
      ]);

      const result = await service.findAllRuleSets();

      expect(result).toHaveLength(1);
      expect(prisma.scaleRuleSet.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        include: { items: { include: { scale: true } } },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('resolveScaleRule', () => {
    it('should return null if product has noScales=true', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'p1',
        noScales: true,
        scaleRuleSetId: 'rs1',
        tags: [],
        category: null,
      });

      const result = await service.resolveScaleRule('p1');
      expect(result).toBeNull();
    });

    it('should return product rule set if defined (highest priority)', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'p1',
        noScales: false,
        scaleRuleSetId: 'rs1',
        scaleRuleSet: {
          id: 'rs1',
          name: 'Product Rule',
          items: [{ scaleId: 's1', percentageIncrease: 0, scale: { name: '28mm' } }],
        },
        tags: [{ scaleRuleSetId: 'rs2', noScales: false }],
        category: { scaleRuleSetId: 'rs3' },
      });

      const result = await service.resolveScaleRule('p1');
      expect(result!.name).toBe('Product Rule');
    });

    it('should return null if any tag has noScales=true', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'p1',
        noScales: false,
        scaleRuleSetId: null,
        scaleRuleSet: null,
        tags: [{ scaleRuleSetId: 'rs2', noScales: true }],
        category: { scaleRuleSetId: 'rs3' },
      });

      const result = await service.resolveScaleRule('p1');
      expect(result).toBeNull();
    });

    it('should fallback to tag rule set', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'p1',
        noScales: false,
        scaleRuleSetId: null,
        scaleRuleSet: null,
        tags: [
          { scaleRuleSetId: null, noScales: false },
          {
            scaleRuleSetId: 'rs2',
            noScales: false,
            scaleRuleSet: {
              id: 'rs2',
              name: 'Tag Rule',
              items: [{ scaleId: 's1', percentageIncrease: 10 }],
            },
          },
        ],
        category: { scaleRuleSetId: 'rs3' },
      });

      const result = await service.resolveScaleRule('p1');
      expect(result!.name).toBe('Tag Rule');
    });

    it('should fallback to category rule set', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'p1',
        noScales: false,
        scaleRuleSetId: null,
        scaleRuleSet: null,
        tags: [],
        category: {
          scaleRuleSetId: 'rs3',
          scaleRuleSet: {
            id: 'rs3',
            name: 'Category Rule',
            items: [{ scaleId: 's1', percentageIncrease: 20 }],
          },
        },
      });

      const result = await service.resolveScaleRule('p1');
      expect(result!.name).toBe('Category Rule');
    });

    it('should return null when no rule applies', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue({
        id: 'p1',
        noScales: false,
        scaleRuleSetId: null,
        scaleRuleSet: null,
        tags: [],
        category: { scaleRuleSetId: null },
      });

      const result = await service.resolveScaleRule('p1');
      expect(result).toBeNull();
    });
  });

  describe('calculateScalePrice', () => {
    it('should apply percentage increase', () => {
      expect(service.calculateScalePrice(100, 15)).toBe(115);
      expect(service.calculateScalePrice(79, 80)).toBe(142.2);
      expect(service.calculateScalePrice(49.9, 150)).toBe(124.75);
    });

    it('should return base price for 0% increase', () => {
      expect(service.calculateScalePrice(100, 0)).toBe(100);
    });
  });
});
