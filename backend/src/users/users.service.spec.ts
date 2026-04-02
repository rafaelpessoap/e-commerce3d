import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('getProfile', () => {
    it('should return user profile without password', async () => {
      const mockUser = {
        id: 'cuid1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'CUSTOMER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.getProfile('cuid1');

      expect(result).toEqual(mockUser);
      expect(result).not.toHaveProperty('password');
    });

    it('should throw NotFoundException for non-existent user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getProfile('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateProfile', () => {
    it('should update user name', async () => {
      const updated = {
        id: 'cuid1',
        email: 'test@example.com',
        name: 'Updated Name',
        role: 'CUSTOMER',
      };

      (prisma.user.update as jest.Mock).mockResolvedValue(updated);

      const result = await service.updateProfile('cuid1', {
        name: 'Updated Name',
      });

      expect(result.name).toBe('Updated Name');
    });

    it('should NOT allow role to be changed via updateProfile', async () => {
      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: 'cuid1',
        role: 'CUSTOMER',
      });

      await service.updateProfile('cuid1', { role: 'ADMIN' } as any);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({ role: 'ADMIN' }),
        }),
      );
    });
  });

  describe('changePassword', () => {
    it('should change password when current password is correct', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'cuid1',
        password: 'oldhash',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('newhash');
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      await service.changePassword('cuid1', {
        currentPassword: 'OldPass123!',
        newPassword: 'NewPass456!',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('NewPass456!', 12);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'cuid1' },
        data: { password: 'newhash' },
      });
    });

    it('should throw BadRequestException when current password is wrong', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'cuid1',
        password: 'oldhash',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword('cuid1', {
          currentPassword: 'WrongPass!',
          newPassword: 'NewPass456!',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
