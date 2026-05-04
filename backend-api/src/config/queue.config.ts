import { registerAs } from '@nestjs/config';

export default registerAs('queue', () => ({
  enabled: process.env.QUEUE_ENABLED === 'true' || false,
  defaultJobOptions: {
    removeOnComplete: parseInt(
      process.env.QUEUE_REMOVE_ON_COMPLETE || '100',
      10,
    ),
    removeOnFail: parseInt(process.env.QUEUE_REMOVE_ON_FAIL || '50', 10),
    attempts: parseInt(process.env.QUEUE_DEFAULT_ATTEMPTS || '3', 10),
  },
}));
