import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
        level: process.env.LOG_LEVEL || 'info',
        autoLogging: true,
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.body.password',
            'req.body.currentPassword',
            'req.body.newPassword',
            'req.body.confirmPassword',
            'req.body.token',
            'req.body.refreshToken',
          ],
          censor: '[REDACTED]',
        },
        serializers: {
          req: (req: Record<string, unknown>) => ({
            id: req.id,
            method: req.method,
            url: req.url,
          }),
          res: (res: Record<string, unknown>) => ({
            statusCode: res.statusCode,
          }),
        },
      },
    }),
  ],
})
export class AppLoggerModule {}
