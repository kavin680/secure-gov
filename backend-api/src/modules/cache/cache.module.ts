import { Module, DynamicModule, Logger } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({})
export class CacheConfigModule {
  private static readonly logger = new Logger(CacheConfigModule.name);

  static register(): DynamicModule {
    return {
      module: CacheConfigModule,
      imports: [
        NestCacheModule.registerAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) => {
            const redisEnabled = configService.get<boolean>('redis.enabled');

            if (redisEnabled) {
              CacheConfigModule.logger.log(
                'Redis cache enabled - connecting to Redis',
              );
            } else {
              CacheConfigModule.logger.log(
                'Redis disabled - using in-memory cache',
              );
            }

            const options: Record<string, unknown> = {
              ttl: configService.get<number>('redis.ttl') || 300,
            };

            if (redisEnabled) {
              options.store = 'ioredis';
              options.host =
                configService.get<string>('redis.host') || 'localhost';
              options.port = configService.get<number>('redis.port') || 6379;
              options.password =
                configService.get<string>('redis.password') || undefined;
              options.keyPrefix =
                configService.get<string>('redis.keyPrefix') || 'enterprise:';
            }

            return options;
          },
          inject: [ConfigService],
        }),
      ],
      exports: [NestCacheModule],
    };
  }
}
