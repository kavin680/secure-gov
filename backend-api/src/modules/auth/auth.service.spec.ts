import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../../database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import {
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Role } from '../../common/enums';

describe('AuthService', () => {
  let service: AuthService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    session: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn((args) => Promise.resolve(args.map(() => ({})))),
  };

  const mockJwtService = {
    signAsync: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, unknown> = {
        'auth.bcryptSaltRounds': 4,
        'auth.jwtSecret': 'test-secret',
        'auth.jwtExpiresIn': '15m',
        'auth.jwtRefreshSecret': 'test-refresh-secret',
        'auth.jwtRefreshExpiresIn': '7d',
        'auth.passwordResetTokenExpiresIn': 3600,
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    const registerDto = {
      email: 'test@example.com',
      password: 'Test@12345',
      firstName: 'Test',
      lastName: 'User',
    };

    it('should register a new user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
      });

      const result = await service.register(registerDto);

      expect(result.message).toBe(
        'Registration successful. Please verify your email.',
      );
      expect(result.userId).toBe('user-1');
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should throw ConflictException if email exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should lowercase the email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
      });

      await service.register({ ...registerDto, email: 'TEST@EXAMPLE.COM' });

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'test@example.com' }),
        }),
      );
    });
  });

  describe('login', () => {
    const loginDto = { email: 'test@example.com', password: 'Test@12345' };
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: Role.USER,
      isActive: true,
      lockedUntil: null,
      loginAttempts: 0,
      password: '', // will be set in each test
    };

    it('should throw UnauthorizedException for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw ForbiddenException for deactivated account', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      await expect(service.login(loginDto)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for locked account', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        lockedUntil: new Date(Date.now() + 1000 * 60 * 30),
      });

      await expect(service.login(loginDto)).rejects.toThrow(ForbiddenException);
    });

    it('should increment login attempts on wrong password', async () => {
      const hash = await bcrypt.hash('CorrectPassword', 4);

      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        password: hash,
      });

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ loginAttempts: 1 }),
        }),
      );
    });

    it('should lock account after max login attempts', async () => {
      const hash = await bcrypt.hash('CorrectPassword', 4);

      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        password: hash,
        loginAttempts: 4,
      });

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            loginAttempts: 5,
            lockedUntil: expect.any(Date),
          }),
        }),
      );
    });

    it('should return tokens on successful login', async () => {
      const hash = await bcrypt.hash('Test@12345', 4);

      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        password: hash,
      });
      mockPrisma.$transaction.mockResolvedValue([
        { id: 'user-1' },
        { id: 'session-1' },
      ]);
      mockJwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      const result = await service.login(loginDto, '127.0.0.1', 'jest');

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.role).toBe(Role.USER);
      expect(result.user).not.toHaveProperty('password');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should revoke specific session when refreshToken provided', async () => {
      mockPrisma.session.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.logout('user-1', 'refresh-token');

      expect(result.message).toBe('Logged out successfully');
      expect(mockPrisma.session.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', refreshToken: 'refresh-token' },
        data: { isRevoked: true },
      });
    });

    it('should revoke all sessions when no refreshToken', async () => {
      mockPrisma.session.updateMany.mockResolvedValue({ count: 3 });

      await service.logout('user-1');

      expect(mockPrisma.session.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { isRevoked: true },
      });
    });
  });

  describe('refreshTokens', () => {
    it('should throw UnauthorizedException for invalid refresh token', async () => {
      mockPrisma.session.findFirst.mockResolvedValue(null);

      await expect(service.refreshTokens('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return new token pair and revoke old session', async () => {
      mockPrisma.session.findFirst.mockResolvedValue({
        id: 'session-1',
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: Role.USER,
          isActive: true,
          deletedAt: null,
        },
        userAgent: 'jest',
        ipAddress: '127.0.0.1',
      });
      mockPrisma.$transaction.mockResolvedValue([{}, { id: 'session-2' }]);
      mockJwtService.signAsync
        .mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce('new-refresh-token');

      const result = await service.refreshTokens('old-refresh-token');

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    it('should throw UnauthorizedException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.changePassword('user-1', {
          currentPassword: 'Old@12345',
          newPassword: 'New@12345',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw BadRequestException for wrong current password', async () => {
      const hash = await bcrypt.hash('RealPassword', 4);

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        password: hash,
      });

      await expect(
        service.changePassword('user-1', {
          currentPassword: 'WrongPassword',
          newPassword: 'New@12345',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update password and revoke all sessions', async () => {
      const hash = await bcrypt.hash('Old@12345', 4);

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        password: hash,
      });
      mockPrisma.$transaction.mockResolvedValue([{}, { count: 1 }]);

      const result = await service.changePassword('user-1', {
        currentPassword: 'Old@12345',
        newPassword: 'New@12345',
      });

      expect(result.message).toBe('Password changed successfully');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('forgotPassword', () => {
    it('should return generic message even if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword({
        email: 'nonexistent@example.com',
      });

      expect(result.message).toContain('If an account exists');
    });

    it('should set reset token for existing user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
      });
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.forgotPassword({
        email: 'test@example.com',
      });

      expect(result.message).toContain('If an account exists');
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            passwordResetToken: expect.any(String),
            passwordResetExpires: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('resetPassword', () => {
    it('should throw BadRequestException for invalid token', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.resetPassword({ token: 'invalid', newPassword: 'New@12345' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update password and revoke sessions', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
      });
      mockPrisma.$transaction.mockResolvedValue([{}, { count: 1 }]);

      const result = await service.resetPassword({
        token: 'valid-token',
        newPassword: 'New@12345',
      });

      expect(result.message).toBe('Password reset successful');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    it('should throw BadRequestException for invalid token', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(service.verifyEmail('invalid')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should verify email and clear token', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
      });
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.verifyEmail('valid-token');

      expect(result.message).toBe('Email verified successfully');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { isEmailVerified: true, emailVerificationToken: null },
      });
    });
  });

  describe('getActiveSessions', () => {
    it('should return active sessions for user', async () => {
      const sessions = [{ id: 'session-1', createdAt: new Date() }];
      mockPrisma.session.findMany.mockResolvedValue(sessions);

      const result = await service.getActiveSessions('user-1');

      expect(result).toEqual(sessions);
    });
  });

  describe('revokeSession', () => {
    it('should revoke specific session', async () => {
      mockPrisma.session.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.revokeSession('user-1', 'session-1');

      expect(result.message).toBe('Session revoked successfully');
    });
  });
});
