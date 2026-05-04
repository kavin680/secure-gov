import { registerAs } from '@nestjs/config';

export default registerAs('monitoring', () => ({
  enabled: process.env.MONITORING_ENABLED === 'true' || false,
  provider: process.env.MONITORING_PROVIDER || 'none',
  datadogApiKey: process.env.DATADOG_API_KEY || '',
  sentryDsn: process.env.SENTRY_DSN || '',
  metricsPort: parseInt(process.env.METRICS_PORT || '9090', 10),
}));
