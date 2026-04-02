import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
            refreshToken: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get<AuthService>(AuthService);
  });

  describe('POST /api/v1/auth/register', () => {
    it('should return user data wrapped in { data }', async () => {
      const dto = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        name: 'Test User',
      };

      const mockResult = {
        id: 'cuid1',
        email: dto.email,
        name: dto.name,
        role: 'CUSTOMER',
        createdAt: new Date(),
      };

      (service.register as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.register(dto);

      expect(result).toEqual({ data: mockResult });
      expect(service.register).toHaveBeenCalledWith(dto);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should return tokens and user wrapped in { data }', async () => {
      const dto = {
        email: 'test@example.com',
        password: 'SecurePass123!',
      };

      const mockResult = {
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        user: { id: '1', email: dto.email, name: 'Test', role: 'CUSTOMER' },
      };

      (service.login as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.login(dto);

      expect(result).toEqual({ data: mockResult });
      expect(service.login).toHaveBeenCalledWith(dto);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should return new tokens wrapped in { data }', async () => {
      const dto = { refreshToken: 'old_refresh_token' };

      const mockResult = {
        accessToken: 'new_access',
        refreshToken: 'new_refresh',
      };

      (service.refreshToken as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.refresh(dto);

      expect(result).toEqual({ data: mockResult });
      expect(service.refreshToken).toHaveBeenCalledWith(dto.refreshToken);
    });
  });
});
