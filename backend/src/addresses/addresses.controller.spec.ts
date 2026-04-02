import { Test, TestingModule } from '@nestjs/testing';
import { AddressesController } from './addresses.controller';
import { AddressesService } from './addresses.service';
import { ViaCepService } from './viacep.service';

describe('AddressesController', () => {
  let controller: AddressesController;
  let service: AddressesService;

  const mockUser = { id: 'user1', email: 'test@example.com', role: 'CUSTOMER' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AddressesController],
      providers: [
        {
          provide: AddressesService,
          useValue: {
            findAll: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: ViaCepService,
          useValue: { lookup: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<AddressesController>(AddressesController);
    service = module.get<AddressesService>(AddressesService);
  });

  const mockAddress = {
    id: 'addr1',
    userId: 'user1',
    street: 'Rua Teste',
    number: '123',
    postalCode: '01001000',
    neighborhood: 'Centro',
    city: 'São Paulo',
    state: 'SP',
    isDefault: false,
  };

  describe('GET /api/v1/addresses', () => {
    it('should return all addresses for the user', async () => {
      (service.findAll as jest.Mock).mockResolvedValue([mockAddress]);

      const result = await controller.findAll(mockUser);

      expect(result).toEqual({ data: [mockAddress] });
    });
  });

  describe('GET /api/v1/addresses/:id', () => {
    it('should return a specific address', async () => {
      (service.findOne as jest.Mock).mockResolvedValue(mockAddress);

      const result = await controller.findOne('addr1', mockUser);

      expect(result).toEqual({ data: mockAddress });
    });
  });

  describe('POST /api/v1/addresses', () => {
    it('should create and return new address', async () => {
      const dto = {
        street: 'Rua Teste',
        number: '123',
        neighborhood: 'Centro',
        city: 'São Paulo',
        state: 'SP',
        postalCode: '01001000',
      };

      (service.create as jest.Mock).mockResolvedValue(mockAddress);

      const result = await controller.create(mockUser, dto);

      expect(result).toEqual({ data: mockAddress });
      expect(service.create).toHaveBeenCalledWith(mockUser.id, dto);
    });
  });

  describe('PUT /api/v1/addresses/:id', () => {
    it('should update and return address', async () => {
      const dto = { number: '999' };
      (service.update as jest.Mock).mockResolvedValue({
        ...mockAddress,
        number: '999',
      });

      const result = await controller.update('addr1', mockUser, dto);

      expect(result.data.number).toBe('999');
    });
  });

  describe('DELETE /api/v1/addresses/:id', () => {
    it('should delete address and return success', async () => {
      (service.remove as jest.Mock).mockResolvedValue(mockAddress);

      const result = await controller.remove('addr1', mockUser);

      expect(result).toEqual({ data: { message: 'Address deleted successfully' } });
    });
  });
});
