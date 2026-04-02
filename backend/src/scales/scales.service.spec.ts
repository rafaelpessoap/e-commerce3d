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
        { appliesTo: 'PRODUCT', targetId: 'prod-1', priceMultiplier: 1.5, priority: 10 },
        { appliesTo: 'CATEGORY', targetId: 'cat-1', priceMultiplier: 1.2, priority: 5 },
        { appliesTo: 'GLOBAL', targetId: null, priceMultiplier: 1.1, priority: 1 },
      ]);

      const price = await service.calculatePrice(100, 'prod-1', 'scale-1', 'cat-1');

      expect(price).toBe(150); // 100 * 1.5
    });

    it('should apply CATEGORY-level rule when no PRODUCT rule', async () => {
      (prisma.scaleRule.findMany as jest.Mock).mockResolvedValue([
        { appliesTo: 'CATEGORY', targetId: 'cat-1', priceMultiplier: 1.2, priority: 5 },
        { appliesTo: 'GLOBAL', targetId: null, priceMultiplier: 1.1, priority: 1 },
      ]);

      const price = await service.calculatePrice(100, 'prod-2', 'scale-1', 'cat-1');

      expect(price).toBe(120); // 100 * 1.2
    });

    it('should fallback to GLOBAL rule', async () => {
      (prisma.scaleRule.findMany as jest.Mock).mockResolvedValue([
        { appliesTo: 'GLOBAL', targetId: null, priceMultiplier: 1.1, priority: 1 },
      ]);

      const price = await service.calculatePrice(100, 'prod-3', 'scale-1', 'cat-1');

      expect(price).toBe(110); // 100 * 1.1
    });

    it('should return base price when no rules exist', async () => {
      (prisma.scaleRule.findMany as jest.Mock).mockResolvedValue([]);

      const price = await service.calculatePrice(100, 'prod-4', 'scale-1', 'cat-1');

      expect(price).toBe(100);
    });

    it('should round to 2 decimal places', async () => {
      (prisma.scaleRule.findMany as jest.Mock).mockResolvedValue([
        { appliesTo: 'GLOBAL', targetId: null, priceMultiplier: 1.333, priority: 1 },
      ]);

      const price = await service.calculatePrice(100, 'prod-5', 'scale-1', 'cat-1');

      expect(price).toBe(133.3); // 100 * 1.333 = 133.3 rounded
    });
  });
});
