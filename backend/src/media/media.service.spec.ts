import { Test, TestingModule } from '@nestjs/testing';
import { MediaService } from './media.service';
import { BadRequestException } from '@nestjs/common';

describe('MediaService', () => {
  let service: MediaService;
  let mockS3Client: any;

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
            bucket: 'miniatures-bucket',
            cdnUrl: 'https://cdn.miniatures3d.com',
          },
        },
      ],
    }).compile();

    service = module.get<MediaService>(MediaService);
  });

  describe('validateFile', () => {
    it('should accept valid image MIME types', () => {
      expect(() =>
        service.validateFile('photo.jpg', 'image/jpeg', 1024 * 1024),
      ).not.toThrow();
    });

    it('should accept png files', () => {
      expect(() =>
        service.validateFile('photo.png', 'image/png', 1024 * 1024),
      ).not.toThrow();
    });

    it('should accept webp files', () => {
      expect(() =>
        service.validateFile('photo.webp', 'image/webp', 1024 * 1024),
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

  describe('generateKey', () => {
    it('should generate a random key with correct extension', () => {
      const key = service.generateKey('photo.jpg');

      expect(key).toMatch(/^products\/[a-f0-9-]+\.jpg$/);
    });

    it('should place files in products/ folder', () => {
      const key = service.generateKey('image.png');

      expect(key.startsWith('products/')).toBe(true);
    });

    it('should generate unique keys for same filename', () => {
      const key1 = service.generateKey('photo.jpg');
      const key2 = service.generateKey('photo.jpg');

      expect(key1).not.toBe(key2);
    });
  });

  describe('upload', () => {
    it('should upload file to S3 and return URL', async () => {
      const buffer = Buffer.from('fake image data');

      const result = await service.upload({
        buffer,
        originalname: 'photo.jpg',
        mimetype: 'image/jpeg',
        size: buffer.length,
      });

      expect(mockS3Client.send).toHaveBeenCalled();
      expect(result.url).toMatch(
        /^https:\/\/cdn\.miniatures3d\.com\/products\//,
      );
      expect(result.key).toMatch(/^products\//);
    });
  });

  describe('delete', () => {
    it('should delete file from S3', async () => {
      await service.delete('products/abc123.jpg');

      expect(mockS3Client.send).toHaveBeenCalled();
    });

    it('should not throw if file does not exist', async () => {
      mockS3Client.send.mockRejectedValueOnce({ Code: 'NoSuchKey' });

      await expect(
        service.delete('products/nonexistent.jpg'),
      ).resolves.not.toThrow();
    });
  });
});
