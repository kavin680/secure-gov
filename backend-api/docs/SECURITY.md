# Security Guide

## Security Measures

### HTTP Security Headers
Helmet is applied globally, setting secure headers including:
- Content-Security-Policy
- X-Content-Type-Options: nosniff
- X-Frame-Options: SAMEORIGIN
- Strict-Transport-Security

### CORS
Configurable origins via `CORS_ORIGINS` environment variable.

### Rate Limiting
- Global: 100 requests per 60 seconds per IP
- Auth endpoints: Configurable separate limits

### Input Validation
- Whitelist mode: Only declared DTO properties accepted
- ForbidNonWhitelisted: Unknown properties rejected
- Transform: Auto-transform types
- class-validator decorators for field validation

### Password Security
- bcrypt hashing with 12 rounds (configurable)
- Complexity requirements: uppercase, lowercase, digit, special character
- Minimum 8 characters

### Account Protection
- Account lockout after 5 failed login attempts
- 30-minute lockout duration
- Login attempt tracking

### Token Security
- Short-lived access tokens (15 min default)
- Refresh token rotation
- Session revocation support

### Data Protection
- Soft deletes preserve data integrity
- Sensitive fields redacted from logs
- Password never returned in API responses
- Production mode suppresses error stack traces

## Security Checklist

- [ ] Change all default secrets before deployment
- [ ] Enable HTTPS/TLS
- [ ] Restrict CORS origins
- [ ] Configure rate limiting
- [ ] Enable email verification
- [ ] Set up log monitoring for security events
- [ ] Regular dependency updates (`npm audit`)
- [ ] Database access restricted to application only
