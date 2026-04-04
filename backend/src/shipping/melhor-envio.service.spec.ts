import { Test, TestingModule } from '@nestjs/testing';
import { MelhorEnvioService } from './melhor-envio.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('MelhorEnvioService', () => {
  let service: MelhorEnvioService;
  let prisma: PrismaService;

  const melhorEnvioResponse = [
    {
      id: 1,
      name: 'PAC',
      price: '25.50',
      discount: '5.00',
      currency: 'R$',
      delivery_time: 8,
      delivery_range: { min: 6, max: 10 },
      company: { id: 1, name: 'Correios', picture: '' },
      error: null,
    },
    {
      id: 2,
      name: 'SEDEX',
      price: '45.90',
      discount: '0',
      currency: 'R$',
      delivery_time: 3,
      delivery_range: { min: 2, max: 4 },
      company: { id: 1, name: 'Correios', picture: '' },
      error: null,
    },
    {
      id: 17,
      name: '.Package',
      price: '18.00',
      discount: '0',
      currency: 'R$',
      delivery_time: 12,
      delivery_range: { min: 10, max: 15 },
      company: { id: 2, name: 'Jadlog', picture: '' },
      error: null,
    },
    {
      id: 99,
      name: 'Serviço Indisponível',
      price: '0',
      error: 'Serviço indisponível para esta rota',
      company: { id: 3, name: 'Azul', picture: '' },
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MelhorEnvioService,
        {
          provide: PrismaService,
          useValue: {
            shippingMethod: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              upsert: jest.fn(),
            },
            product: {
              findUnique: jest.fn(),
            },
            setting: {
              findUnique: jest.fn().mockResolvedValue(null),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                MELHOR_ENVIO_TOKEN: 'test-token-123',
                MELHOR_ENVIO_URL: 'https://sandbox.melhorenvio.com.br',
                SHOP_CEP: '01001000',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<MelhorEnvioService>(MelhorEnvioService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getQuotes', () => {
    it('should return only quotes from enabled shipping methods', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => melhorEnvioResponse,
      });
      (prisma.shippingMethod.findMany as jest.Mock).mockResolvedValue([
        { serviceId: 1, name: 'PAC', company: 'Correios', isActive: true, displayName: null, extraDays: 0 },
        { serviceId: 2, name: 'SEDEX', company: 'Correios', isActive: true, displayName: null, extraDays: 0 },
        // serviceId 17 NOT enabled
      ]);

      const result = await service.getQuotes({
        toCep: '30130000',
        products: [
          { weight: 0.5, width: 15, height: 10, length: 20, quantity: 1, price: 50 },
        ],
      });

      expect(result).toHaveLength(2);
      expect(result[0].serviceId).toBe(1);
      expect(result[0].name).toBe('PAC');
      expect(result[0].price).toBe(25.5);
      expect(result[1].serviceId).toBe(2);
      expect(result[1].name).toBe('SEDEX');
    });

    it('should add extra days to delivery time', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => melhorEnvioResponse,
      });
      (prisma.shippingMethod.findMany as jest.Mock).mockResolvedValue([
        { serviceId: 1, name: 'PAC', company: 'Correios', isActive: true, displayName: null, extraDays: 0 },
      ]);

      const result = await service.getQuotes({
        toCep: '30130000',
        products: [
          { weight: 0.5, width: 15, height: 10, length: 20, quantity: 1, price: 50 },
        ],
        extraDays: 5,
      });

      expect(result[0].deliveryDays).toBe(8 + 5); // 8 from API + 5 extra
      expect(result[0].deliveryRange.min).toBe(6 + 5);
      expect(result[0].deliveryRange.max).toBe(10 + 5);
    });

    it('should filter out services with errors', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => melhorEnvioResponse,
      });
      (prisma.shippingMethod.findMany as jest.Mock).mockResolvedValue([
        { serviceId: 1, name: 'PAC', company: 'Correios', isActive: true, displayName: null, extraDays: 0 },
        { serviceId: 99, name: 'Azul', company: 'Azul', isActive: true, displayName: null, extraDays: 0 },
      ]);

      const result = await service.getQuotes({
        toCep: '30130000',
        products: [
          { weight: 0.5, width: 15, height: 10, length: 20, quantity: 1, price: 50 },
        ],
      });

      // Service 99 has error, should be filtered out
      expect(result).toHaveLength(1);
      expect(result[0].serviceId).toBe(1);
    });

    it('should call Melhor Envio API with correct params', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [],
      });
      (prisma.shippingMethod.findMany as jest.Mock).mockResolvedValue([]);

      await service.getQuotes({
        toCep: '30130000',
        products: [
          { weight: 0.3, width: 11, height: 5, length: 16, quantity: 2, price: 40 },
        ],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token-123',
          }),
        }),
      );
    });

    it('should throw BadRequestException on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        text: async () => 'Validation error',
      });
      (prisma.shippingMethod.findMany as jest.Mock).mockResolvedValue([]);

      await expect(
        service.getQuotes({
          toCep: '30130000',
          products: [
            { weight: 0.5, width: 15, height: 10, length: 20, quantity: 1, price: 50 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getEnabledMethods', () => {
    it('should return all active shipping methods', async () => {
      (prisma.shippingMethod.findMany as jest.Mock).mockResolvedValue([
        { serviceId: 1, name: 'PAC', company: 'Correios', isActive: true },
      ]);

      const result = await service.getEnabledMethods();

      expect(result).toHaveLength(1);
    });
  });

  describe('toggleMethod', () => {
    it('should upsert shipping method', async () => {
      (prisma.shippingMethod.upsert as jest.Mock).mockResolvedValue({
        serviceId: 1,
        name: 'PAC',
        company: 'Correios',
        isActive: true,
      });

      const result = await service.toggleMethod({
        serviceId: 1,
        name: 'PAC',
        company: 'Correios',
        isActive: true,
      });

      expect(prisma.shippingMethod.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { serviceId: 1 },
        }),
      );
      expect(result.isActive).toBe(true);
    });
  });

  describe('getAvailableServices', () => {
    it('should return list of all Melhor Envio services', () => {
      const services = service.getAvailableServices();

      expect(services.length).toBeGreaterThan(0);
      expect(services[0]).toHaveProperty('id');
      expect(services[0]).toHaveProperty('name');
      expect(services[0]).toHaveProperty('company');
    });
  });

  describe('syncServicesFromApi', () => {
    it('should use multiple destination CEPs to discover more carriers', async () => {
      // First call returns Correios only, second call returns Loggi too
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            { id: 1, name: 'PAC', company: { id: 1, name: 'Correios' }, error: null },
            { id: 2, name: 'SEDEX', company: { id: 1, name: 'Correios' }, error: null },
          ],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            { id: 1, name: 'PAC', company: { id: 1, name: 'Correios' }, error: null },
            { id: 31, name: 'Express', company: { id: 9, name: 'Loggi' }, error: null },
          ],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            { id: 1, name: 'PAC', company: { id: 1, name: 'Correios' }, error: null },
            { id: 33, name: 'Standard', company: { id: 10, name: 'JeT' }, error: null },
          ],
        });

      (prisma.shippingMethod.upsert as jest.Mock).mockImplementation(async (args: { create: { serviceId: number; name: string; company: string } }) => args.create);

      const result = await service.syncServicesFromApi();

      // Should discover services from ALL destinations (deduplicated)
      const serviceIds = result.services.map((s) => s.id);
      expect(serviceIds).toContain(1);  // PAC from first call
      expect(serviceIds).toContain(2);  // SEDEX from first call
      expect(serviceIds).toContain(31); // Loggi from second call
      expect(serviceIds).toContain(33); // JeT from third call

      // Should have called fetch multiple times (multiple destinations)
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should deduplicate services found across multiple destinations', async () => {
      // PAC appears in all responses
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [
          { id: 1, name: 'PAC', company: { id: 1, name: 'Correios' }, error: null },
        ],
      });

      (prisma.shippingMethod.upsert as jest.Mock).mockImplementation(async (args: { create: { serviceId: number; name: string; company: string } }) => args.create);

      const result = await service.syncServicesFromApi();

      // PAC should only appear once despite being in all responses
      const pacCount = result.services.filter((s) => s.id === 1).length;
      expect(pacCount).toBe(1);
    });

    it('should skip services with errors in sync responses', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [
          { id: 1, name: 'PAC', company: { id: 1, name: 'Correios' }, error: null },
          { id: 99, name: 'Indisponível', error: 'Não disponível', company: { id: 3, name: 'Teste' } },
        ],
      });

      (prisma.shippingMethod.upsert as jest.Mock).mockImplementation(async (args: { create: { serviceId: number; name: string; company: string } }) => args.create);

      const result = await service.syncServicesFromApi();

      const serviceIds = result.services.map((s) => s.id);
      expect(serviceIds).toContain(1);
      expect(serviceIds).not.toContain(99);
    });
  });

  describe('getQuotes — edge cases', () => {
    it('should enforce minimum weight and dimensions for API call', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [
          { id: 1, name: 'PAC', price: '20.00', delivery_time: 5, delivery_range: { min: 4, max: 6 }, company: { name: 'Correios' }, error: null },
        ],
      });
      (prisma.shippingMethod.findMany as jest.Mock).mockResolvedValue([
        { serviceId: 1, name: 'PAC', company: 'Correios', isActive: true, displayName: null, extraDays: 0 },
      ]);

      await service.getQuotes({
        toCep: '92323010',
        products: [
          { weight: 0, width: 0, height: 0, length: 0, quantity: 1, price: 0 },
        ],
      });

      // Check that the API was called with enforced minimums, not zeros
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const product = callBody.products[0];
      expect(product.weight).toBeGreaterThan(0);
      expect(product.width).toBeGreaterThan(0);
      expect(product.height).toBeGreaterThan(0);
      expect(product.length).toBeGreaterThan(0);
      expect(product.insurance_value).toBeGreaterThan(0);
    });

    it('should continue even if one destination fails during sync', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            { id: 1, name: 'PAC', company: { id: 1, name: 'Correios' }, error: null },
          ],
        })
        .mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'Error' })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            { id: 31, name: 'Express', company: { id: 9, name: 'Loggi' }, error: null },
          ],
        });

      (prisma.shippingMethod.upsert as jest.Mock).mockImplementation(async (args: { create: { serviceId: number; name: string; company: string } }) => args.create);

      const result = await service.syncServicesFromApi();

      // Should still have results from successful calls
      const serviceIds = result.services.map((s) => s.id);
      expect(serviceIds).toContain(1);
      expect(serviceIds).toContain(31);
    });
  });
});
