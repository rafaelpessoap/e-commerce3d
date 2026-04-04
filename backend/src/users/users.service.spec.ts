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
            address: {
              findMany: jest.fn(),
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

  describe('findAll', () => {
    it('should return paginated list of users', async () => {
      const mockUsers = [
        { id: 'u1', email: 'a@a.com', name: 'Alice', role: 'CUSTOMER', cpf: '12345678900', phone: '11999999999', createdAt: new Date(), _count: { orders: 2 } },
        { id: 'u2', email: 'b@b.com', name: 'Bob', role: 'CUSTOMER', cpf: null, phone: null, createdAt: new Date(), _count: { orders: 0 } },
      ];
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
      (prisma.user.count as jest.Mock).mockResolvedValue(2);

      const result = await service.findAll({ page: 1, perPage: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
    });

    it('should filter by search term (name, email or cpf)', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.user.count as jest.Mock).mockResolvedValue(0);

      await service.findAll({ page: 1, perPage: 10, search: 'alice' });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ name: expect.any(Object) }),
              expect.objectContaining({ email: expect.any(Object) }),
              expect.objectContaining({ cpf: expect.any(Object) }),
            ]),
          }),
        }),
      );
    });
  });

  describe('updateProfile with cpf/phone', () => {
    it('should update cpf and phone', async () => {
      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: 'cuid1',
        cpf: '12345678900',
        phone: '11999999999',
      });

      const result = await service.updateProfile('cuid1', {
        cpf: '12345678900',
        phone: '11999999999',
      });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cpf: '12345678900',
            phone: '11999999999',
          }),
        }),
      );
    });
  });

  describe('adminUpdateUser', () => {
    it('should update user name, cpf, phone and isActive', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1' });
      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: 'u1',
        name: 'New Name',
        cpf: '99999999999',
        phone: '21888888888',
        isActive: false,
      });

      const result = await service.adminUpdateUser('u1', {
        name: 'New Name',
        cpf: '99999999999',
        phone: '21888888888',
        isActive: false,
      });

      expect(result.name).toBe('New Name');
      expect(result.isActive).toBe(false);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'New Name', isActive: false }),
        }),
      );
    });

    it('should throw NotFoundException for non-existent user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.adminUpdateUser('bad-id', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should NOT allow role or password changes', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1' });
      (prisma.user.update as jest.Mock).mockResolvedValue({ id: 'u1' });

      await service.adminUpdateUser('u1', {
        role: 'ADMIN',
        password: 'hacked',
      } as any);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({ role: 'ADMIN', password: 'hacked' }),
        }),
      );
    });
  });

  describe('adminGetUserAddresses', () => {
    it('should return addresses for a given user', async () => {
      const mockAddresses = [
        { id: 'a1', street: 'Rua A', city: 'SP', userId: 'u1' },
        { id: 'a2', street: 'Rua B', city: 'RJ', userId: 'u1' },
      ];
      (prisma.address.findMany as jest.Mock).mockResolvedValue(mockAddresses);

      const result = await service.adminGetUserAddresses('u1');

      expect(result).toHaveLength(2);
      expect(prisma.address.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u1' } }),
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
