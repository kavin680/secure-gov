export const APP_CONSTANTS = {
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
  },
  AUTH: {
    MAX_LOGIN_ATTEMPTS: 5,
    LOCK_DURATION_MINUTES: 30,
    SESSION_EXPIRY_MS: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
  CACHE: {
    DEFAULT_TTL: 300, // 5 minutes
    USER_TTL: 600, // 10 minutes
  },
  SECURITY: {
    RATE_LIMIT_TTL: 60,
    RATE_LIMIT_MAX: 100,
    AUTH_RATE_LIMIT_MAX: 10,
    SENSITIVE_FIELDS: [
      'password',
      'currentPassword',
      'newPassword',
      'confirmPassword',
      'token',
      'refreshToken',
    ],
  },
  WEBHOOKS: {
    DELIVERY_TIMEOUT_MS: 10000, // 10 seconds
  },
  FILE_UPLOAD: {
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_MIME_TYPES: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/csv',
      'application/json',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  },
} as const;
