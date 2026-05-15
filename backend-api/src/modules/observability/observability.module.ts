import { Global, Module, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';

@Global()
@Module({})
export class ObservabilityModule implements OnModuleInit {
  private readonly logger = new Logger(ObservabilityModule.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const provider = this.configService.get<string>('monitoring.provider');
    const enabled = this.configService.get<boolean>('monitoring.enabled');

    if (!enabled) {
      this.logger.warn('Observability is disabled');
      return;
    }

    if (provider === 'sentry') {
      this.initSentry();
    }

    if (provider === 'datadog') {
      this.initDatadog();
    }
  }

  private initSentry() {
    const dsn = this.configService.get<string>('monitoring.sentryDsn');
    if (!dsn) {
      this.logger.warn('Sentry DSN not configured — skipping');
      return;
    }

    Sentry.init({
      dsn,
      environment: this.configService.get<string>('app.env') || 'development',
      tracesSampleRate:
        this.configService.get<string>('app.env') === 'production' ? 0.1 : 1.0,
      integrations: [Sentry.httpIntegration()],
    });

    this.logger.log('Sentry error tracking initialized');
  }

  private initDatadog() {
    const apiKey = this.configService.get<string>('monitoring.datadogApiKey');
    if (!apiKey) {
      this.logger.warn('Datadog API key not configured — skipping');
      return;
    }

    // Datadog APM is typically initialized via dd-trace before the app starts.
    // Set DD_API_KEY, DD_SERVICE, DD_ENV environment variables and
    // start the app with: node --require dd-trace/init dist/main.js
    this.logger.log(
      'Datadog configured via environment. Use dd-trace/init to enable APM.',
    );
  }
}
