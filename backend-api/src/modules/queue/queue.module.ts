import { Module, DynamicModule, Logger } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({})
export class QueueConfigModule {
  private static readonly logger = new Logger(QueueConfigModule.name);

  static register(): DynamicModule {
    return {
      module: QueueConfigModule,
      imports: [
        BullModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) => {
            const queueEnabled = configService.get<boolean>('queue.enabled');

            if (!queueEnabled) {
              QueueConfigModule.logger.warn('Queue system is disabled');
              return {
                connection: {
                  host: 'localhost',
                  port: 6379,
                  lazyConnect: true,
                  maxRetriesPerRequest: 0,
                },
              };
            }

            QueueConfigModule.logger.log(
              'Queue system enabled — connecting to Redis',
            );

            return {
              connection: {
                host: configService.get<string>('redis.host'),
                port: configService.get<number>('redis.port'),
                password: configService.get<string>('redis.password'),
              },
              defaultJobOptions: configService.get('queue.defaultJobOptions'),
            };
          },
          inject: [ConfigService],
        }),
      ],
      exports: [BullModule],
    };
  }
}
