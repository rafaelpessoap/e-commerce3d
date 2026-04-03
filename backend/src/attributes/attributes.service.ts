import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import slugify from 'slug';

@Injectable()
export class AttributesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: { name: string }) {
    const slug = slugify(dto.name, { lower: true });

    const existing = await this.prisma.attribute.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException('Attribute already exists');
    }

    return this.prisma.attribute.create({
      data: { name: dto.name, slug },
    });
  }

  async findAll() {
    return this.prisma.attribute.findMany({
      include: { values: { orderBy: { value: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  async findBySlug(slug: string) {
    const attr = await this.prisma.attribute.findUnique({
      where: { slug },
      include: { values: true },
    });
    if (!attr) throw new NotFoundException('Attribute not found');
    return attr;
  }

  async update(id: string, dto: { name?: string }) {
    const data: Record<string, string> = {};
    if (dto.name) {
      data.name = dto.name;
      data.slug = slugify(dto.name, { lower: true });
    }
    return this.prisma.attribute.update({ where: { id }, data });
  }

  async delete(id: string) {
    return this.prisma.attribute.delete({ where: { id } });
  }

  async createValue(attributeId: string, dto: { value: string }) {
    const slug = slugify(dto.value, { lower: true });

    const existing = await this.prisma.attributeValue.findFirst({
      where: { attributeId, slug },
    });
    if (existing) {
      throw new ConflictException('Value already exists for this attribute');
    }

    return this.prisma.attributeValue.create({
      data: { attributeId, value: dto.value, slug },
    });
  }

  async deleteValue(valueId: string) {
    return this.prisma.attributeValue.delete({ where: { id: valueId } });
  }
}
