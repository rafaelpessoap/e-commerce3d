import { Test, TestingModule } from '@nestjs/testing';
import { ViaCepService } from './viacep.service';
import { BadRequestException } from '@nestjs/common';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('ViaCepService', () => {
  let service: ViaCepService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ViaCepService],
    }).compile();

    service = module.get<ViaCepService>(ViaCepService);
    mockFetch.mockReset();
  });

  describe('lookup', () => {
    it('should return address data for valid CEP', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          cep: '01001-000',
          logradouro: 'Praça da Sé',
          bairro: 'Sé',
          localidade: 'São Paulo',
          uf: 'SP',
          erro: undefined,
        }),
      });

      const result = await service.lookup('01001000');

      expect(result).toEqual({
        postalCode: '01001000',
        street: 'Praça da Sé',
        neighborhood: 'Sé',
        city: 'São Paulo',
        state: 'SP',
      });
    });

    it('should throw BadRequestException for invalid CEP', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ erro: true }),
      });

      await expect(service.lookup('00000000')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for malformed CEP', async () => {
      await expect(service.lookup('123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return null fields when API fails (allow manual input)', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await service.lookup('01001000');

      expect(result).toBeNull();
    });
  });
});
