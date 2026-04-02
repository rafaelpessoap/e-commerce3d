import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            getProfile: jest.fn(),
            updateProfile: jest.fn(),
            changePassword: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  const mockUser = {
    id: 'cuid1',
    email: 'test@example.com',
    name: 'Test',
    role: 'CUSTOMER',
  };

  describe('GET /api/v1/users/me', () => {
    it('should return current user profile', async () => {
      (service.getProfile as jest.Mock).mockResolvedValue(mockUser);

      const result = await controller.getProfile(mockUser);

      expect(result).toEqual({ data: mockUser });
      expect(service.getProfile).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('PUT /api/v1/users/me', () => {
    it('should update and return user profile', async () => {
      const dto = { name: 'Updated' };
      const updated = { ...mockUser, name: 'Updated' };
      (service.updateProfile as jest.Mock).mockResolvedValue(updated);

      const result = await controller.updateProfile(mockUser, dto);

      expect(result).toEqual({ data: updated });
    });
  });

  describe('PUT /api/v1/users/me/password', () => {
    it('should change password and return success message', async () => {
      const dto = {
        currentPassword: 'OldPass123!',
        newPassword: 'NewPass456!',
      };
      (service.changePassword as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.changePassword(mockUser, dto);

      expect(result).toEqual({
        data: { message: 'Password changed successfully' },
      });
    });
  });
});
