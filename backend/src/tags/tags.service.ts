import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import slugify from 'slug';

@Injectable()
export class TagsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: { name: string; color?: string; extraDays?: number }) {
    const slug = slugify(dto.name, { lower: true });

    const existing = await this.prisma.tag.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException('Tag name already exists');
    }

    return this.prisma.tag.create({
      data: { name: dto.name, slug, color: dto.color, extraDays: dto.extraDays },
    });
  }

  async findAll() {
    return this.prisma.tag.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async update(id: string, dto: { name?: string; color?: string; extraDays?: number }) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = { ...dto };
    if (dto.name) {
      data.slug = slugify(dto.name, { lower: true });
    }
    return this.prisma.tag.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.tag.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
