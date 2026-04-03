import { Test, TestingModule } from '@nestjs/testing';
import { MediaService } from './media.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

// Mock Sharp
jest.mock('sharp', () => {
  const mockSharp = jest.fn(() => ({
    metadata: jest.fn().mockResolvedValue({ width: 2000, height: 1500, format: 'jpeg' }),
    resize: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('webp-data')),
  }));
  return mockSharp;
});

describe('MediaService', () => {
  let service: MediaService;
  let mockS3Client: any;
  let prisma: PrismaService;

  beforeEach(async () => {
    mockS3Client = {
      send: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        { provide: 'S3_CLIENT', useValue: mockS3Client },
        {
          provide: 'MEDIA_CONFIG',
          useValue: {
            bucket: 'test-bucket',
            cdnUrl: 'https://cdn.test.com',
          },
        },
        {
          provide: PrismaService,
          useValue: {
            mediaFile: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<MediaService>(MediaService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  // ── Existing tests ────────────────────────────────

  describe('validateFile', () => {
    it('should accept valid image MIME types', () => {
      expect(() =>
        service.validateFile('photo.jpg', 'image/jpeg', 1024 * 1024),
      ).not.toThrow();
    });

    it('should reject non-image MIME types', () => {
      expect(() =>
        service.validateFile('doc.pdf', 'application/pdf', 1024),
      ).toThrow(BadRequestException);
    });

    it('should reject files exceeding 10MB', () => {
      expect(() =>
        service.validateFile('big.jpg', 'image/jpeg', 11 * 1024 * 1024),
      ).toThrow(BadRequestException);
    });

    it('should reject mismatched extension and MIME type', () => {
      expect(() =>
        service.validateFile('fake.jpg', 'application/javascript', 1024),
      ).toThrow(BadRequestException);
    });
  });

  // ── Pipeline tests (TDD RED → these must FAIL first) ──

  describe('processAndUpload', () => {
    const fakeBuffer = Buffer.from('fake-image-data');
    const mockMediaFile = {
      id: 'media1',
      filename: 'photo.jpg',
      mimeType: 'image/jpeg',
      size: 1024,
      thumb: 'https://cdn.test.com/media/uuid/thumb.webp',
      card: 'https://cdn.test.com/media/uuid/card.webp',
      gallery: 'https://cdn.test.com/media/uuid/gallery.webp',
      full: 'https://cdn.test.com/media/uuid/full.webp',
      alt: null,
      title: null,
      description: null,
      width: 2000,
      height: 1500,
    };

    it('should convert image and generate 4 WebP variants', async () => {
      (prisma.mediaFile.create as jest.Mock).mockResolvedValue(mockMediaFile);

      const result = await service.processAndUpload(
        fakeBuffer,
        'photo.jpg',
        'image/jpeg',
        fakeBuffer.length,
      );

      // Should upload 4 variants to S3
      expect(mockS3Client.send).toHaveBeenCalledTimes(4);
      expect(result.thumb).toContain('/thumb.webp');
      expect(result.card).toContain('/card.webp');
      expect(result.gallery).toContain('/gallery.webp');
      expect(result.full).toContain('/full.webp');
    });

    it('should save MediaFile record with metadata', async () => {
      (prisma.mediaFile.create as jest.Mock).mockResolvedValue(mockMediaFile);

      await service.processAndUpload(fakeBuffer, 'photo.jpg', 'image/jpeg', fakeBuffer.length);

      expect(prisma.mediaFile.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          filename: 'photo.jpg',
          mimeType: 'image/jpeg',
          width: 2000,
          height: 1500,
        }),
      });
    });

    it('should read original image dimensions via Sharp', async () => {
      (prisma.mediaFile.create as jest.Mock).mockResolvedValue(mockMediaFile);

      const result = await service.processAndUpload(fakeBuffer, 'photo.jpg', 'image/jpeg', fakeBuffer.length);

      expect(result.width).toBe(2000);
      expect(result.height).toBe(1500);
    });
  });

  describe('deleteMediaFile', () => {
    it('should delete 4 variants from S3 and record from DB', async () => {
      (prisma.mediaFile.findUnique as jest.Mock).mockResolvedValue({
        id: 'media1',
        thumb: 'https://cdn.test.com/media/abc/thumb.webp',
        card: 'https://cdn.test.com/media/abc/card.webp',
        gallery: 'https://cdn.test.com/media/abc/gallery.webp',
        full: 'https://cdn.test.com/media/abc/full.webp',
      });
      (prisma.mediaFile.delete as jest.Mock).mockResolvedValue({});

      await service.deleteMediaFile('media1');

      // 4 S3 deletes + 1 DB delete
      expect(mockS3Client.send).toHaveBeenCalledTimes(4);
      expect(prisma.mediaFile.delete).toHaveBeenCalledWith({
        where: { id: 'media1' },
      });
    });
  });

  describe('updateMediaMeta', () => {
    it('should update alt, title, description', async () => {
      (prisma.mediaFile.update as jest.Mock).mockResolvedValue({
        id: 'media1',
        alt: 'Guerreira élfica',
        title: 'Miniatura guerreira',
        description: 'Uma guerreira élfica em pose de combate',
      });

      const result = await service.updateMediaMeta('media1', {
        alt: 'Guerreira élfica',
        title: 'Miniatura guerreira',
        description: 'Uma guerreira élfica em pose de combate',
      });

      expect(prisma.mediaFile.update).toHaveBeenCalledWith({
        where: { id: 'media1' },
        data: {
          alt: 'Guerreira élfica',
          title: 'Miniatura guerreira',
          description: 'Uma guerreira élfica em pose de combate',
        },
      });
      expect(result.alt).toBe('Guerreira élfica');
    });
  });

  describe('findAllMedia', () => {
    it('should return paginated media files', async () => {
      (prisma.mediaFile.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.mediaFile.count as jest.Mock).mockResolvedValue(0);

      const result = await service.findAllMedia({ page: 1, perPage: 20 });

      expect(result.meta).toEqual({ total: 0, page: 1, perPage: 20, lastPage: 1 });
    });

    it('should search by filename or alt', async () => {
      (prisma.mediaFile.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.mediaFile.count as jest.Mock).mockResolvedValue(0);

      await service.findAllMedia({ page: 1, perPage: 20, search: 'guerreira' });

      expect(prisma.mediaFile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { filename: { contains: 'guerreira', mode: 'insensitive' } },
              { alt: { contains: 'guerreira', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
    });
  });
});
