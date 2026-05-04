import { registerAs } from '@nestjs/config';

export default registerAs('mail', () => ({
  enabled: process.env.MAIL_ENABLED === 'true' || false,
  host: process.env.MAIL_HOST || 'smtp.mailtrap.io',
  port: parseInt(process.env.MAIL_PORT || '587', 10),
  secure: process.env.MAIL_SECURE === 'true' || false,
  user: process.env.MAIL_USER || '',
  password: process.env.MAIL_PASSWORD || '',
  from: process.env.MAIL_FROM || '"Enterprise App" <noreply@enterprise.com>',
}));
