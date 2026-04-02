import { Test, TestingModule } from '@nestjs/testing';
import { PagesService } from './pages.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('PagesService', () => {
  let service: PagesService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PagesService,
        {
          provide: PrismaService,
          useValue: {
            page: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<PagesService>(PagesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('findBySlug', () => {
    it('should return page by slug', async () => {
      (prisma.page.findUnique as jest.Mock).mockResolvedValue({
        id: 'p1', title: 'About', slug: 'about', content: '<p>Hello</p>',
      });

      const result = await service.findBySlug('about');
      expect(result.slug).toBe('about');
    });

    it('should throw NotFoundException', async () => {
      (prisma.page.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.findBySlug('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create page with auto-slug', async () => {
      (prisma.page.create as jest.Mock).mockResolvedValue({
        id: 'p1', title: 'Custom Page', slug: 'custom-page', content: 'hi',
      });

      const result = await service.create({ title: 'Custom Page', content: 'hi' });
      expect(result.slug).toBe('custom-page');
    });
  });
});
