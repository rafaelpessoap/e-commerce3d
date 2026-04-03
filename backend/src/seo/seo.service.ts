import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const STATIC_PAGES = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/sobre', priority: '0.5', changefreq: 'monthly' },
  { path: '/contato', priority: '0.5', changefreq: 'monthly' },
  { path: '/faq', priority: '0.5', changefreq: 'monthly' },
  { path: '/termos', priority: '0.3', changefreq: 'yearly' },
  { path: '/privacidade', priority: '0.3', changefreq: 'yearly' },
];

@Injectable()
export class SeoService {
  constructor(private prisma: PrismaService) {}

  async upsertMeta(dto: {
    entityType: string;
    entityId: string;
    title?: string;
    description?: string;
    ogImage?: string;
    keywords?: string;
    canonical?: string;
  }) {
    return this.prisma.seoMeta.upsert({
      where: {
        entityType_entityId: {
          entityType: dto.entityType,
          entityId: dto.entityId,
        },
      },
      update: {
        title: dto.title,
        description: dto.description,
        ogImage: dto.ogImage,
        keywords: dto.keywords,
        canonical: dto.canonical,
      },
      create: dto,
    });
  }

  async getMeta(entityType: string, entityId: string) {
    return this.prisma.seoMeta.findUnique({
      where: { entityType_entityId: { entityType, entityId } },
    });
  }

  async generateSitemap(baseUrl: string): Promise<string> {
    const [products, categories, blogPosts] = await Promise.all([
      this.prisma.product.findMany({
        where: { isActive: true },
        select: { slug: true, updatedAt: true },
      }),
      this.prisma.category.findMany({
        where: { isActive: true },
        select: { slug: true, updatedAt: true },
      }),
      this.prisma.blogPost.findMany({
        where: { isPublished: true },
        select: { slug: true, updatedAt: true },
      }),
    ]);

    const urls: string[] = [];

    // Static pages
    for (const page of STATIC_PAGES) {
      urls.push(
        `  <url>
    <loc>${baseUrl}${page.path}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`,
      );
    }

    // Products
    for (const p of products) {
      urls.push(
        `  <url>
    <loc>${baseUrl}/p/${p.slug}</loc>
    <lastmod>${p.updatedAt.toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`,
      );
    }

    // Categories
    for (const c of categories) {
      urls.push(
        `  <url>
    <loc>${baseUrl}/c/${c.slug}</loc>
    <lastmod>${c.updatedAt.toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`,
      );
    }

    // Blog posts
    for (const b of blogPosts) {
      urls.push(
        `  <url>
    <loc>${baseUrl}/blog/${b.slug}</loc>
    <lastmod>${b.updatedAt.toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`,
      );
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;
  }
}
