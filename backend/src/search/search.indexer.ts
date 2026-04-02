import { Injectable, Logger } from '@nestjs/common';
import { SearchService, ProductDocument } from './search.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SearchIndexer {
  private readonly logger = new Logger(SearchIndexer.name);

  constructor(
    private searchService: SearchService,
    private prisma: PrismaService,
  ) {}

  private toDocument(product: any): ProductDocument {
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      basePrice: product.basePrice,
      categoryName: product.category?.name,
      brandName: product.brand?.name,
      tags: product.tags?.map((t: any) => t.name) ?? [],
      isActive: product.isActive,
    };
  }

  async indexProductById(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { category: true, brand: true, tags: true },
    });

    if (!product || !product.isActive) {
      await this.searchService.removeProduct(productId);
      return;
    }

    await this.searchService.indexProduct(this.toDocument(product));
  }

  async reindexAll() {
    this.logger.log('Starting full reindex...');

    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      include: { category: true, brand: true, tags: true },
    });

    const docs = products.map((p) => this.toDocument(p));
    await this.searchService.bulkIndex(docs);

    this.logger.log(`Reindexed ${docs.length} products`);
  }
}
