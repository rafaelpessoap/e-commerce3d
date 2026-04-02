import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { extname } from 'path';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];
const _ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const MIME_TO_EXT: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
};

interface MediaConfig {
  bucket: string;
  cdnUrl: string;
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    @Inject('S3_CLIENT') private readonly s3Client: any,
    @Inject('MEDIA_CONFIG') private readonly config: MediaConfig,
  ) {}

  validateFile(filename: string, mimetype: string, size: number) {
    // Validar MIME type
    if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
      throw new BadRequestException(
        `File type not allowed. Accepted: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    // Validar tamanho
    if (size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      );
    }

    // Validar extensão vs MIME type
    const ext = extname(filename).toLowerCase();
    const allowedExts = MIME_TO_EXT[mimetype];
    if (!allowedExts || !allowedExts.includes(ext)) {
      throw new BadRequestException('File extension does not match MIME type');
    }
  }

  generateKey(originalname: string): string {
    const ext = extname(originalname).toLowerCase();
    const uuid = randomUUID();
    return `products/${uuid}${ext}`;
  }

  async upload(file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
  }): Promise<{ url: string; key: string }> {
    this.validateFile(file.originalname, file.mimetype, file.size);

    const key = this.generateKey(file.originalname);

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    const url = `${this.config.cdnUrl}/${key}`;

    return { url, key };
  }

  async delete(key: string) {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
        }),
      );
    } catch (err: any) {
      if (err?.Code === 'NoSuchKey') return;
      throw err;
    }
  }
}
