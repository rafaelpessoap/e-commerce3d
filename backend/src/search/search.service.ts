import { Injectable, Inject, Logger } from '@nestjs/common';

const INDEX_NAME = 'products';

export interface ProductDocument {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  categoryName?: string;
  brandName?: string;
  tags: string[];
  isActive: boolean;
}

export interface SearchParams {
  query: string;
  categoryName?: string;
  brandName?: string;
  priceMin?: number;
  priceMax?: number;
  page?: number;
  perPage?: number;
}

export interface SearchResult {
  total: number;
  hits: ProductDocument[];
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(@Inject('ELASTICSEARCH_CLIENT') private readonly esClient: any) {}

  async ensureIndex() {
    const exists = await this.esClient.indices.exists({ index: INDEX_NAME });
    if (!exists) {
      await this.esClient.indices.create({
        index: INDEX_NAME,
        body: {
          mappings: {
            properties: {
              name: { type: 'text', analyzer: 'standard' },
              description: { type: 'text', analyzer: 'standard' },
              basePrice: { type: 'float' },
              categoryName: { type: 'keyword' },
              brandName: { type: 'keyword' },
              tags: { type: 'keyword' },
              isActive: { type: 'boolean' },
            },
          },
        },
      });
    }
  }

  async indexProduct(doc: ProductDocument) {
    const { id, ...body } = doc;
    await this.esClient.index({
      index: INDEX_NAME,
      id,
      document: body,
    });
  }

  async removeProduct(id: string) {
    try {
      await this.esClient.delete({ index: INDEX_NAME, id });
    } catch (err: any) {
      if (err?.statusCode === 404) return;
      throw err;
    }
  }

  async bulkIndex(docs: ProductDocument[]) {
    if (docs.length === 0) return;

    const operations = docs.flatMap((doc) => {
      const { id, ...body } = doc;
      return [{ index: { _index: INDEX_NAME, _id: id } }, body];
    });

    await this.esClient.bulk({ body: operations });
  }

  async search(params: SearchParams): Promise<SearchResult> {
    const { query, categoryName, brandName, priceMin, priceMax } = params;
    const page = params.page ?? 1;
    const perPage = params.perPage ?? 20;

    const must: any[] = [];
    const filter: any[] = [{ term: { isActive: true } }];

    if (query) {
      must.push({
        multi_match: {
          query,
          fields: ['name^3', 'description', 'tags^2'],
          fuzziness: 'AUTO',
        },
      });
    }

    if (categoryName) {
      filter.push({ term: { categoryName } });
    }

    if (brandName) {
      filter.push({ term: { brandName } });
    }

    if (priceMin !== undefined || priceMax !== undefined) {
      const range: Record<string, number> = {};
      if (priceMin !== undefined) range.gte = priceMin;
      if (priceMax !== undefined) range.lte = priceMax;
      filter.push({ range: { basePrice: range } });
    }

    const response = await this.esClient.search({
      index: INDEX_NAME,
      body: {
        from: (page - 1) * perPage,
        size: perPage,
        query: {
          bool: {
            must: must.length > 0 ? must : [{ match_all: {} }],
            filter,
          },
        },
      },
    });

    const total =
      typeof response.hits.total === 'number'
        ? response.hits.total
        : response.hits.total.value;

    const hits: ProductDocument[] = response.hits.hits.map((hit: any) => ({
      id: hit._id,
      ...hit._source,
    }));

    return { total, hits };
  }
}
