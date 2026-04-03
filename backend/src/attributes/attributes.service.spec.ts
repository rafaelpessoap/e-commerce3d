import { Test, TestingModule } from '@nestjs/testing';
import { AttributesService } from './attributes.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('AttributesService', () => {
  let service: AttributesService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttributesService,
        {
          provide: PrismaService,
          useValue: {
            attribute: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            attributeValue: {
              create: jest.fn(),
              delete: jest.fn(),
              findFirst: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AttributesService>(AttributesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('create', () => {
    it('should create attribute with auto-slug', async () => {
      (prisma.attribute.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.attribute.create as jest.Mock).mockResolvedValue({
        id: 'attr1',
        name: 'Arma',
        slug: 'arma',
      });

      const result = await service.create({ name: 'Arma' });

      expect(result.slug).toBe('arma');
    });

    it('should throw ConflictException for duplicate name', async () => {
      (prisma.attribute.findUnique as jest.Mock).mockResolvedValue({ id: 'existing' });

      await expect(service.create({ name: 'Arma' })).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return attributes with their values', async () => {
      (prisma.attribute.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'attr1',
          name: 'Arma',
          slug: 'arma',
          values: [
            { id: 'v1', value: 'Espada', slug: 'espada' },
            { id: 'v2', value: 'Adaga', slug: 'adaga' },
          ],
        },
      ]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].values).toHaveLength(2);
    });
  });

  describe('createValue', () => {
    it('should create a value for an attribute', async () => {
      (prisma.attributeValue.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.attributeValue.create as jest.Mock).mockResolvedValue({
        id: 'v1',
        attributeId: 'attr1',
        value: 'Espada',
        slug: 'espada',
      });

      const result = await service.createValue('attr1', { value: 'Espada' });

      expect(result.slug).toBe('espada');
    });

    it('should throw ConflictException for duplicate value in same attribute', async () => {
      (prisma.attributeValue.findFirst as jest.Mock).mockResolvedValue({ id: 'existing' });

      await expect(
        service.createValue('attr1', { value: 'Espada' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('deleteValue', () => {
    it('should delete an attribute value', async () => {
      (prisma.attributeValue.delete as jest.Mock).mockResolvedValue({});

      await service.deleteValue('v1');

      expect(prisma.attributeValue.delete).toHaveBeenCalledWith({
        where: { id: 'v1' },
      });
    });
  });

  describe('delete', () => {
    it('should delete attribute and cascade values', async () => {
      (prisma.attribute.delete as jest.Mock).mockResolvedValue({});

      await service.delete('attr1');

      expect(prisma.attribute.delete).toHaveBeenCalledWith({
        where: { id: 'attr1' },
      });
    });
  });
});
