import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';

describe('SearchService', () => {
  let service: SearchService;
  let mockEsClient: any;

  beforeEach(async () => {
    mockEsClient = {
      indices: {
        exists: jest.fn(),
        create: jest.fn(),
      },
      index: jest.fn(),
      delete: jest.fn(),
      search: jest.fn(),
      bulk: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: 'ELASTICSEARCH_CLIENT', useValue: mockEsClient },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  describe('indexProduct', () => {
    it('should index a product document in Elasticsearch', async () => {
      mockEsClient.index.mockResolvedValue({ result: 'created' });

      await service.indexProduct({
        id: 'prod1',
        name: 'Warrior Miniature',
        description: 'A mighty warrior',
        basePrice: 49.9,
        categoryName: 'Fantasy',
        brandName: 'Arsenal Craft',
        tags: ['rpg', 'fantasy'],
        isActive: true,
      });

      expect(mockEsClient.index).toHaveBeenCalledWith({
        index: 'products',
        id: 'prod1',
        document: expect.objectContaining({
          name: 'Warrior Miniature',
          basePrice: 49.9,
          categoryName: 'Fantasy',
        }),
      });
    });
  });

  describe('removeProduct', () => {
    it('should delete a product from the index', async () => {
      mockEsClient.delete.mockResolvedValue({ result: 'deleted' });

      await service.removeProduct('prod1');

      expect(mockEsClient.delete).toHaveBeenCalledWith({
        index: 'products',
        id: 'prod1',
      });
    });

    it('should not throw if product not found in index', async () => {
      mockEsClient.delete.mockRejectedValue({ statusCode: 404 });

      await expect(service.removeProduct('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('search', () => {
    it('should return products matching a text query', async () => {
      mockEsClient.search.mockResolvedValue({
        hits: {
          total: { value: 1 },
          hits: [
            {
              _id: 'prod1',
              _score: 1.5,
              _source: {
                name: 'Warrior Miniature',
                description: 'A mighty warrior',
                basePrice: 49.9,
                categoryName: 'Fantasy',
                brandName: 'Arsenal Craft',
                tags: ['rpg'],
                isActive: true,
              },
            },
          ],
        },
      });

      const result = await service.search({ query: 'warrior' });

      expect(result.total).toBe(1);
      expect(result.hits).toHaveLength(1);
      expect(result.hits[0].name).toBe('Warrior Miniature');
    });

    it('should filter by category', async () => {
      mockEsClient.search.mockResolvedValue({
        hits: { total: { value: 0 }, hits: [] },
      });

      await service.search({ query: 'warrior', categoryName: 'Sci-Fi' });

      expect(mockEsClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            query: expect.objectContaining({
              bool: expect.objectContaining({
                filter: expect.arrayContaining([
                  { term: { categoryName: 'Sci-Fi' } },
                ]),
              }),
            }),
          }),
        }),
      );
    });

    it('should filter by price range', async () => {
      mockEsClient.search.mockResolvedValue({
        hits: { total: { value: 0 }, hits: [] },
      });

      await service.search({ query: 'miniature', priceMin: 20, priceMax: 80 });

      expect(mockEsClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            query: expect.objectContaining({
              bool: expect.objectContaining({
                filter: expect.arrayContaining([
                  { range: { basePrice: { gte: 20, lte: 80 } } },
                ]),
              }),
            }),
          }),
        }),
      );
    });

    it('should paginate results', async () => {
      mockEsClient.search.mockResolvedValue({
        hits: { total: { value: 50 }, hits: [] },
      });

      await service.search({ query: 'miniature', page: 3, perPage: 10 });

      expect(mockEsClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            from: 20,
            size: 10,
          }),
        }),
      );
    });

    it('should only return active products', async () => {
      mockEsClient.search.mockResolvedValue({
        hits: { total: { value: 0 }, hits: [] },
      });

      await service.search({ query: 'test' });

      expect(mockEsClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            query: expect.objectContaining({
              bool: expect.objectContaining({
                filter: expect.arrayContaining([{ term: { isActive: true } }]),
              }),
            }),
          }),
        }),
      );
    });
  });
});
