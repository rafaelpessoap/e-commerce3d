import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import slugify from 'slug';

@Injectable()
export class BrandsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: { name: string; description?: string; logo?: string }) {
    const slug = slugify(dto.name, { lower: true });

    const existing = await this.prisma.brand.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException('Brand name already exists');
    }

    return this.prisma.brand.create({
      data: { name: dto.name, slug, description: dto.description, logo: dto.logo },
    });
  }

  async findAll() {
    return this.prisma.brand.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findBySlug(slug: string) {
    const brand = await this.prisma.brand.findUnique({ where: { slug } });
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }
    return brand;
  }

  async update(
    id: string,
    dto: { name?: string; description?: string; logo?: string },
  ) {
    const data: Record<string, any> = { ...dto };
    if (dto.name) {
      data.slug = slugify(dto.name, { lower: true });
    }
    return this.prisma.brand.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.brand.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
