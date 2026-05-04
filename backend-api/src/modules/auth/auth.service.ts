import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import {
  hashPassword,
  comparePassword,
  generateToken,
} from '../../common/utils';
import { JwtPayload } from '../../common/interfaces';
import { Role } from '../../common/enums';
import { APP_CONSTANTS } from '../../common/constants';
import {
  RegisterDto,
  LoginDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await hashPassword(
      dto.password,
      this.configService.get<number>('auth.bcryptSaltRounds'),
    );

    const emailVerificationToken = generateToken();

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        password: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        emailVerificationToken,
      },
    });

    this.logger.log(`User registered: ${user.email}`);

    return {
      message: 'Registration successful. Please verify your email.',
      userId: user.id,
    };
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase(), deletedAt: null },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Account is deactivated');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException(
        `Account is locked. Try again after ${user.lockedUntil.toISOString()}`,
      );
    }

    const isPasswordValid = await comparePassword(dto.password, user.password);

    if (!isPasswordValid) {
      const attempts = user.loginAttempts + 1;
      const updateData: Record<string, unknown> = { loginAttempts: attempts };

      if (attempts >= APP_CONSTANTS.AUTH.MAX_LOGIN_ATTEMPTS) {
        updateData.lockedUntil = new Date(
          Date.now() + APP_CONSTANTS.AUTH.LOCK_DURATION_MINUTES * 60 * 1000,
        );
        this.logger.warn(`Account locked: ${user.email}`);
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role as Role,
    });

    // Transaction: reset login attempts + create session atomically
    const [, session] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          loginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: new Date(),
          lastLoginIp: ipAddress,
        },
      }),
      this.prisma.session.create({
        data: {
          userId: user.id,
          refreshToken: tokens.refreshToken,
          userAgent,
          ipAddress,
          expiresAt: new Date(
            Date.now() + APP_CONSTANTS.AUTH.SESSION_EXPIRY_MS,
          ),
        },
      }),
    ]);

    this.logger.log(`User logged in: ${user.email}`);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      sessionId: session.id,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      await this.prisma.session.updateMany({
        where: { userId, refreshToken },
        data: { isRevoked: true },
      });
    } else {
      await this.prisma.session.updateMany({
        where: { userId },
        data: { isRevoked: true },
      });
    }

    this.logger.log(`User logged out: ${userId}`);
    return { message: 'Logged out successfully' };
  }

  async refreshTokens(refreshToken: string) {
    const session = await this.prisma.session.findFirst({
      where: {
        refreshToken,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!session || !session.user.isActive || session.user.deletedAt) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = await this.generateTokens({
      sub: session.user.id,
      email: session.user.email,
      role: session.user.role as Role,
    });

    // Transaction: revoke old session + create new session atomically
    await this.prisma.$transaction([
      this.prisma.session.update({
        where: { id: session.id },
        data: { isRevoked: true },
      }),
      this.prisma.session.create({
        data: {
          userId: session.user.id,
          refreshToken: tokens.refreshToken,
          userAgent: session.userAgent,
          ipAddress: session.ipAddress,
          expiresAt: new Date(
            Date.now() + APP_CONSTANTS.AUTH.SESSION_EXPIRY_MS,
          ),
        },
      }),
    ]);

    return tokens;
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isValid = await comparePassword(dto.currentPassword, user.password);
    if (!isValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const hashedPassword = await hashPassword(
      dto.newPassword,
      this.configService.get<number>('auth.bcryptSaltRounds'),
    );

    // Transaction: update password + revoke all sessions atomically
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      }),
      this.prisma.session.updateMany({
        where: { userId },
        data: { isRevoked: true },
      }),
    ]);

    this.logger.log(`Password changed for user: ${userId}`);
    return { message: 'Password changed successfully' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return {
        message: 'If an account exists, a password reset email will be sent',
      };
    }

    const token = generateToken();
    const expiresIn =
      this.configService.get<number>('auth.passwordResetTokenExpiresIn') ||
      3600;

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetExpires: new Date(Date.now() + expiresIn * 1000),
      },
    });

    // TODO: Send email with reset link via MailModule
    this.logger.log(`Password reset requested for: ${user.email}`);

    return {
      message: 'If an account exists, a password reset email will be sent',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: dto.token,
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await hashPassword(
      dto.newPassword,
      this.configService.get<number>('auth.bcryptSaltRounds'),
    );

    // Transaction: reset password + revoke all sessions atomically
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          passwordResetToken: null,
          passwordResetExpires: null,
        },
      }),
      this.prisma.session.updateMany({
        where: { userId: user.id },
        data: { isRevoked: true },
      }),
    ]);

    this.logger.log(`Password reset completed for: ${user.email}`);
    return { message: 'Password reset successful' };
  }

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findFirst({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerificationToken: null,
      },
    });

    this.logger.log(`Email verified for: ${user.email}`);
    return { message: 'Email verified successfully' };
  }

  async getActiveSessions(userId: string) {
    return this.prisma.session.findMany({
      where: {
        userId,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeSession(userId: string, sessionId: string) {
    await this.prisma.session.updateMany({
      where: { id: sessionId, userId },
      data: { isRevoked: true },
    });

    return { message: 'Session revoked successfully' };
  }

  private async generateTokens(payload: JwtPayload) {
    const tokenPayload = {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(tokenPayload, {
        secret:
          this.configService.get<string>('auth.jwtSecret') || 'fallback-secret',
        expiresIn: (this.configService.get<string>('auth.jwtExpiresIn') ||
          '15m') as any,
      }),
      this.jwtService.signAsync(tokenPayload, {
        secret:
          this.configService.get<string>('auth.jwtRefreshSecret') ||
          'fallback-refresh-secret',
        expiresIn: (this.configService.get<string>(
          'auth.jwtRefreshExpiresIn',
        ) || '7d') as any,
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
