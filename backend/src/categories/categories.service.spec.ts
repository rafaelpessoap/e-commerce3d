import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: PrismaService,
          useValue: {
            category: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('create', () => {
    it('should create category with auto-generated slug', async () => {
      (prisma.category.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.category.create as jest.Mock).mockResolvedValue({
        id: 'cat1',
        name: 'Fantasy Miniatures',
        slug: 'fantasy-miniatures',
        parentId: null,
        isActive: true,
      });

      const result = await service.create({
        name: 'Fantasy Miniatures',
        description: 'Miniaturas fantasia',
      });

      expect(result.slug).toBe('fantasy-miniatures');
    });

    it('should create nested category with parentId', async () => {
      (prisma.category.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.category.create as jest.Mock).mockResolvedValue({
        id: 'cat2',
        name: 'Elves',
        slug: 'elves',
        parentId: 'cat1',
      });

      const result = await service.create({
        name: 'Elves',
        parentId: 'cat1',
      });

      expect(result.parentId).toBe('cat1');
    });

    it('should throw ConflictException for duplicate slug', async () => {
      (prisma.category.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing',
        slug: 'fantasy-miniatures',
      });

      await expect(
        service.create({ name: 'Fantasy Miniatures' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return categories hierarchy (root with children)', async () => {
      const categories = [
        {
          id: 'cat1',
          name: 'Fantasy',
          slug: 'fantasy',
          children: [{ id: 'cat2', name: 'Elves', slug: 'elves' }],
        },
      ];

      (prisma.category.findMany as jest.Mock).mockResolvedValue(categories);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].children).toHaveLength(1);
    });
  });

  describe('findBySlug', () => {
    it('should return category by slug', async () => {
      (prisma.category.findUnique as jest.Mock).mockResolvedValue({
        id: 'cat1',
        name: 'Fantasy',
        slug: 'fantasy',
      });

      const result = await service.findBySlug('fantasy');

      expect(result.slug).toBe('fantasy');
    });

    it('should throw NotFoundException for non-existent slug', async () => {
      (prisma.category.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findBySlug('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update category and regenerate slug if name changes', async () => {
      (prisma.category.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.category.update as jest.Mock).mockResolvedValue({
        id: 'cat1',
        name: 'Sci-Fi',
        slug: 'sci-fi',
      });

      const result = await service.update('cat1', { name: 'Sci-Fi' });

      expect(result.slug).toBe('sci-fi');
    });
  });
});
