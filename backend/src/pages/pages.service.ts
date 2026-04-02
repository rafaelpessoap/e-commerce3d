import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import slugify from 'slug';

@Injectable()
export class PagesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.page.findMany({ orderBy: { title: 'asc' } });
  }

  async findBySlug(slug: string) {
    const page = await this.prisma.page.findUnique({ where: { slug } });
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  async create(dto: { title: string; content: string }) {
    return this.prisma.page.create({
      data: {
        title: dto.title,
        slug: slugify(dto.title, { lower: true }),
        content: dto.content,
      },
    });
  }

  async update(
    id: string,
    dto: { title?: string; content?: string; isPublished?: boolean },
  ) {
    const data: Record<string, any> = { ...dto };
    if (dto.title) data.slug = slugify(dto.title, { lower: true });
    return this.prisma.page.update({ where: { id }, data });
  }
}
