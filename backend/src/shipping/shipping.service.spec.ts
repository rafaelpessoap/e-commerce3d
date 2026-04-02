import { Test, TestingModule } from '@nestjs/testing';
import { ShippingService } from './shipping.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ShippingService', () => {
  let service: ShippingService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShippingService,
        {
          provide: PrismaService,
          useValue: {
            freeShippingRule: {
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<ShippingService>(ShippingService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('checkFreeShipping', () => {
    it('should return true when zipCode in range and value meets minimum', async () => {
      (prisma.freeShippingRule.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'rule1',
          zipCodeStart: '01000000',
          zipCodeEnd: '09999999',
          minOrderValue: 150,
          isActive: true,
        },
      ]);

      const result = await service.checkFreeShipping('01001000', 200);

      expect(result).toBe(true);
    });

    it('should return false when value below minimum', async () => {
      (prisma.freeShippingRule.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'rule1',
          zipCodeStart: '01000000',
          zipCodeEnd: '09999999',
          minOrderValue: 150,
          isActive: true,
        },
      ]);

      const result = await service.checkFreeShipping('01001000', 100);

      expect(result).toBe(false);
    });

    it('should return false when zipCode out of range', async () => {
      (prisma.freeShippingRule.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'rule1',
          zipCodeStart: '01000000',
          zipCodeEnd: '09999999',
          minOrderValue: 150,
          isActive: true,
        },
      ]);

      const result = await service.checkFreeShipping('30000000', 200);

      expect(result).toBe(false);
    });

    it('should return false when no rules exist', async () => {
      (prisma.freeShippingRule.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.checkFreeShipping('01001000', 200);

      expect(result).toBe(false);
    });

    it('should match first applicable rule', async () => {
      (prisma.freeShippingRule.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'rule1',
          zipCodeStart: '01000000',
          zipCodeEnd: '09999999',
          minOrderValue: 300,
          isActive: true,
        },
        {
          id: 'rule2',
          zipCodeStart: '01000000',
          zipCodeEnd: '05000000',
          minOrderValue: 100,
          isActive: true,
        },
      ]);

      // First rule requires 300, value is 200 — fails
      // Second rule requires 100, value is 200, zip in range — passes
      const result = await service.checkFreeShipping('02000000', 200);

      expect(result).toBe(true);
    });
  });

  describe('createFreeShippingRule', () => {
    it('should create a free shipping rule', async () => {
      (prisma.freeShippingRule.create as jest.Mock).mockResolvedValue({
        id: 'rule1',
        zipCodeStart: '01000000',
        zipCodeEnd: '09999999',
        minOrderValue: 150,
        isActive: true,
      });

      const result = await service.createFreeShippingRule({
        zipCodeStart: '01000000',
        zipCodeEnd: '09999999',
        minOrderValue: 150,
      });

      expect(result.minOrderValue).toBe(150);
    });
  });
});
