import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  url:
    process.env.DATABASE_URL ||
    'postgresql://postgres:password@localhost:5432/enterprise_db?schema=public',
  logging: process.env.DATABASE_LOGGING === 'true' || false,
  maxConnections: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '10', 10),
}));
