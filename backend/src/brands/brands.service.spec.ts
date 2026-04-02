import { Test, TestingModule } from '@nestjs/testing';
import { BrandsService } from './brands.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('BrandsService', () => {
  let service: BrandsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrandsService,
        {
          provide: PrismaService,
          useValue: {
            brand: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<BrandsService>(BrandsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('create', () => {
    it('should create brand with auto-slug', async () => {
      (prisma.brand.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.brand.create as jest.Mock).mockResolvedValue({
        id: 'b1',
        name: 'Arsenal Craft',
        slug: 'arsenal-craft',
      });

      const result = await service.create({ name: 'Arsenal Craft' });

      expect(result.slug).toBe('arsenal-craft');
    });

    it('should throw ConflictException for duplicate name', async () => {
      (prisma.brand.findUnique as jest.Mock).mockResolvedValue({ id: 'existing' });

      await expect(service.create({ name: 'Arsenal Craft' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findBySlug', () => {
    it('should return brand by slug', async () => {
      (prisma.brand.findUnique as jest.Mock).mockResolvedValue({
        id: 'b1',
        name: 'Arsenal Craft',
        slug: 'arsenal-craft',
      });

      const result = await service.findBySlug('arsenal-craft');

      expect(result.slug).toBe('arsenal-craft');
    });

    it('should throw NotFoundException for non-existent slug', async () => {
      (prisma.brand.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findBySlug('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
