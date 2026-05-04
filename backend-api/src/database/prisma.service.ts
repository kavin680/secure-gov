import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? [
              { level: 'query', emit: 'event' },
              { level: 'error', emit: 'stdout' },
              { level: 'warn', emit: 'stdout' },
            ]
          : [{ level: 'error', emit: 'stdout' }],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connection established');

    if (process.env.NODE_ENV === 'development') {
      // @ts-expect-error -- Prisma event typing
      this.$on('query', (e: { query: string; duration: number }) => {
        this.logger.debug(`Query: ${e.query} [${e.duration}ms]`);
      });
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database connection closed');
  }

  async softDelete<T>(
    model: string,
    where: Record<string, unknown>,
  ): Promise<T> {
    return (this as Record<string, any>)[model].update({
      where,
      data: { deletedAt: new Date() },
    });
  }

  async restore<T>(model: string, where: Record<string, unknown>): Promise<T> {
    return (this as Record<string, any>)[model].update({
      where,
      data: { deletedAt: null },
    });
  }
}
