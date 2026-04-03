import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { EmailQueueService } from '../email/email-queue.service';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            refreshToken: {
              create: jest.fn(),
              findUnique: jest.fn(),
              delete: jest.fn(),
              deleteMany: jest.fn(),
            },
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock_token'),
          },
        },
        {
          provide: EmailQueueService,
          useValue: {
            enqueuePasswordReset: jest.fn().mockResolvedValue({ id: 'job-1' }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
  });

  describe('register', () => {
    const validDto = {
      email: 'test@example.com',
      password: 'SecurePass123!',
      name: 'Test User',
    };

    it('should create a new user with hashed password and CUSTOMER role', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedpassword');
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: 'cuid1',
        email: validDto.email,
        name: validDto.name,
        role: 'CUSTOMER',
        createdAt: new Date(),
      });

      const result = await service.register(validDto);

      expect(result).toHaveProperty('id');
      expect(result.email).toBe(validDto.email);
      expect(result.role).toBe('CUSTOMER');
      expect(bcrypt.hash).toHaveBeenCalledWith(validDto.password, 12);
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: validDto.email,
            password: 'hashedpassword',
            role: 'CUSTOMER',
          }),
        }),
      );
    });

    it('should throw ConflictException for duplicate email', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: '1',
        email: validDto.email,
      });

      await expect(service.register(validDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should NEVER allow role to be set from registration', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedpassword');
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: 'cuid1',
        email: validDto.email,
        name: validDto.name,
        role: 'CUSTOMER',
        createdAt: new Date(),
      });

      await service.register({ ...validDto, role: 'ADMIN' } as any);

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: 'CUSTOMER',
          }),
        }),
      );
    });

    it('should never return the password hash', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedpassword');
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: 'cuid1',
        email: validDto.email,
        name: validDto.name,
        role: 'CUSTOMER',
        createdAt: new Date(),
      });

      const result = await service.register(validDto);

      expect(result).not.toHaveProperty('password');
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'SecurePass123!',
    };

    const mockUser = {
      id: 'cuid1',
      email: loginDto.email,
      name: 'Test User',
      password: 'hashedpassword',
      role: 'CUSTOMER',
      isActive: true,
    };

    it('should return tokens and user data with valid credentials', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result.user).not.toHaveProperty('password');
    });

    it('should throw UnauthorizedException for non-existent email', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should use generic error message to prevent user enumeration', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      try {
        await service.login(loginDto);
      } catch (e: any) {
        expect(e.message).toBe('Invalid email or password');
      }
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        isActive: false,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should update lastLoginAt on successful login', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      await service.login(loginDto);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: expect.objectContaining({ lastLoginAt: expect.any(Date) }),
        }),
      );
    });
  });

  describe('refreshToken', () => {
    it('should return new tokens with valid refresh token', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'rt1',
        userId: 'cuid1',
        token: 'valid_token',
        expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        revokedAt: null,
      });
      (prisma.refreshToken.delete as jest.Mock).mockResolvedValue({});
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});

      const result = await service.refreshToken('valid_token');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should invalidate old token and create new one (rotation)', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'rt1',
        userId: 'cuid1',
        token: 'old_token',
        expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        revokedAt: null,
      });
      (prisma.refreshToken.delete as jest.Mock).mockResolvedValue({});
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});

      await service.refreshToken('old_token');

      expect(prisma.refreshToken.delete).toHaveBeenCalledWith({
        where: { token: 'old_token' },
      });
      expect(prisma.refreshToken.create).toHaveBeenCalled();
    });

    it('should throw for expired refresh token', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'rt1',
        userId: 'cuid1',
        token: 'expired_token',
        expiresAt: new Date(Date.now() - 1000),
        revokedAt: null,
      });

      await expect(service.refreshToken('expired_token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw for invalid (non-existent) refresh token', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.refreshToken('invalid_token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw for revoked refresh token', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'rt1',
        userId: 'cuid1',
        token: 'revoked_token',
        expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        revokedAt: new Date(),
      });

      await expect(service.refreshToken('revoked_token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('forgotPassword', () => {
    it('should generate reset token and send email for existing user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'cuid1',
        email: 'test@example.com',
        name: 'Test',
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      const emailQueueService = module.get<EmailQueueService>(EmailQueueService);

      await service.forgotPassword('test@example.com');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cuid1' },
          data: expect.objectContaining({
            passwordResetToken: expect.any(String),
            passwordResetExpires: expect.any(Date),
          }),
        }),
      );
      expect(emailQueueService.enqueuePasswordReset).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          name: 'Test',
          resetUrl: expect.stringContaining('reset-password'),
        }),
      );
    });

    it('should NOT throw for non-existent email (prevent enumeration)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.forgotPassword('nonexistent@example.com'),
      ).resolves.not.toThrow();
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'cuid1',
        passwordResetToken: 'valid_token',
        passwordResetExpires: new Date(Date.now() + 3600000),
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue('newhashed');
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      await service.resetPassword('valid_token', 'NewPass123!');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'cuid1' },
        data: {
          password: 'newhashed',
          passwordResetToken: null,
          passwordResetExpires: null,
        },
      });
    });

    it('should throw for invalid token', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.resetPassword('invalid_token', 'NewPass123!'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw for expired token', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'cuid1',
        passwordResetToken: 'expired_token',
        passwordResetExpires: new Date(Date.now() - 1000),
      });

      await expect(
        service.resetPassword('expired_token', 'NewPass123!'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
