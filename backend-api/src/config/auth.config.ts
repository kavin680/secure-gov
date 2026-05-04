import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  jwtSecret: process.env.JWT_SECRET || 'super-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  jwtRefreshSecret:
    process.env.JWT_REFRESH_SECRET || 'super-refresh-secret-change-me',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
  emailVerificationEnabled:
    process.env.EMAIL_VERIFICATION_ENABLED === 'true' || false,
  passwordResetTokenExpiresIn: parseInt(
    process.env.PASSWORD_RESET_TOKEN_EXPIRES_IN || '3600',
    10,
  ),
}));
