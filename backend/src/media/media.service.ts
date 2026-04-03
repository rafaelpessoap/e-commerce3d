import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import sharp from 'sharp';

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

// Variantes de tamanho para pipeline de imagens
const IMAGE_VARIANTS = [
  { name: 'thumb', width: 150, quality: 75 },
  { name: 'card', width: 400, quality: 80 },
  { name: 'gallery', width: 800, quality: 85 },
  { name: 'full', width: 1600, quality: 90 },
] as const;

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
    private readonly prisma: PrismaService,
  ) {}

  validateFile(filename: string, mimetype: string, size: number) {
    if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
      throw new BadRequestException(
        `File type not allowed. Accepted: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    if (size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      );
    }

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

  /**
   * Pipeline de processamento: converte para WebP, gera 4 tamanhos, upload R2, salva DB.
   */
  async processAndUpload(
    buffer: Buffer,
    originalname: string,
    mimetype: string,
    size: number,
  ) {
    this.validateFile(originalname, mimetype, size);

    // Ler metadata original
    const metadata = await sharp(buffer).metadata();
    const originalWidth = metadata.width ?? 0;
    const originalHeight = metadata.height ?? 0;

    const uuid = randomUUID();
    const urls: Record<string, string> = {};

    // Gerar e upload 4 variantes em paralelo
    await Promise.all(
      IMAGE_VARIANTS.map(async (variant) => {
        // Nao ampliar se original menor que target
        const targetWidth = Math.min(variant.width, originalWidth);

        const webpBuffer = await sharp(buffer)
          .resize(targetWidth, undefined, { withoutEnlargement: true })
          .webp({ quality: variant.quality })
          .toBuffer();

        const key = `media/${uuid}/${variant.name}.webp`;

        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.config.bucket,
            Key: key,
            Body: webpBuffer,
            ContentType: 'image/webp',
            CacheControl: 'public, max-age=31536000, immutable',
          }),
        );

        urls[variant.name] = `${this.config.cdnUrl}/${key}`;
      }),
    );

    // Salvar no banco
    const mediaFile = await this.prisma.mediaFile.create({
      data: {
        filename: originalname,
        mimeType: mimetype,
        size,
        thumb: urls.thumb,
        card: urls.card,
        gallery: urls.gallery,
        full: urls.full,
        width: originalWidth,
        height: originalHeight,
      },
    });

    return mediaFile;
  }

  /**
   * Deleta as 4 variantes do R2 e o registro do DB.
   */
  async deleteMediaFile(id: string) {
    const mediaFile = await this.prisma.mediaFile.findUnique({
      where: { id },
    });

    if (!mediaFile) throw new NotFoundException('Media file not found');

    // Extrair keys das URLs e deletar do R2
    const urls = [mediaFile.thumb, mediaFile.card, mediaFile.gallery, mediaFile.full];
    await Promise.all(
      urls.map(async (url) => {
        const key = url.replace(`${this.config.cdnUrl}/`, '');
        try {
          await this.s3Client.send(
            new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }),
          );
        } catch {
          // Ignore delete errors
        }
      }),
    );

    await this.prisma.mediaFile.delete({ where: { id } });
  }

  /**
   * Atualiza metadados SEO de uma imagem.
   */
  async updateMediaMeta(
    id: string,
    dto: { alt?: string; title?: string; description?: string },
  ) {
    return this.prisma.mediaFile.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * Lista galeria paginada com busca.
   */
  async findAllMedia(params: { page: number; perPage: number; search?: string }) {
    const { page, perPage, search } = params;
    const skip = (page - 1) * perPage;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};
    if (search) {
      where.OR = [
        { filename: { contains: search, mode: 'insensitive' } },
        { alt: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.mediaFile.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.mediaFile.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        perPage,
        lastPage: Math.ceil(total / perPage) || 1,
      },
    };
  }

  async findMediaById(id: string) {
    const media = await this.prisma.mediaFile.findUnique({ where: { id } });
    if (!media) throw new NotFoundException('Media file not found');
    return media;
  }

  // ── Legacy: upload simples (blog, etc.) ──

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

    return { url: `${this.config.cdnUrl}/${key}`, key };
  }

  async delete(key: string) {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }),
      );
    } catch (err: any) {
      if (err?.Code === 'NoSuchKey') return;
      throw err;
    }
  }
}
