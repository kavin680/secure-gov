# Security Guide

## Security Architecture Overview

The platform implements defense-in-depth security with multiple layers:

```
┌─────────────────────────────────────────────────────────────┐
│                    Security Layers                          │
├─────────────────────────────────────────────────────────────┤
│  1. Transport Security    │ HTTPS, Helmet headers, CORS     │
│  2. Rate Limiting         │ ThrottlerGuard (100 req/min)     │
│  3. Authentication        │ JWT (access + refresh tokens)    │
│  4. Authorization         │ RBAC (RolesGuard)                │
│  5. Tenant Isolation      │ TenantGuard + query filtering    │
│  6. Input Validation      │ class-validator, whitelist mode  │
│  7. Policy Enforcement    │ PolicyEvaluationService          │
│  8. Encryption at Rest    │ AES-256-CBC (API keys), bcrypt   │
│  9. Audit Logging         │ Every action tracked             │
└─────────────────────────────────────────────────────────────┘
```

## Authentication

### JWT Token Flow

```
Login → Access Token (15min) + Refresh Token (7 days)
       │
       ├─ Access Token expired? → Use Refresh Token to get new pair
       │
       └─ Refresh Token expired? → Re-authenticate
```

- **Access tokens** are short-lived (15 minutes default)
- **Refresh tokens** are stored in the database with session tracking
- **Token rotation:** Each refresh issues a new refresh token and revokes the old one
- **Session revocation:** Logout revokes the refresh token

### Password Security

- Hashed with **bcrypt** (salt rounds: 10)
- **Account lockout** after 5 failed attempts (30 minute lockout)
- Failed login attempts tracked per user
- Lockout status checked before authentication

### JWT Payload

```json
{
  "sub": "user-uuid",
  "email": "user@tenant.com",
  "role": "TENANT_ADMIN",
  "tenantId": "tenant-uuid",
  "sessionId": "session-uuid",
  "iat": 1714800000,
  "exp": 1714800900
}
```

## Authorization (RBAC)

### Role Hierarchy

| Role | Scope | Capabilities |
|------|-------|-------------|
| SUPER_ADMIN | Platform-wide | All operations, tenant management, cross-tenant access |
| TENANT_ADMIN | Single tenant | Manage users, policies, API keys within their tenant |
| DEVELOPER | Single tenant | Upload documents, use AI gateway, view logs |
| USER | Single tenant | Use AI gateway, search documents, view own data |

### Guard Pipeline

Every request passes through guards in order:

1. **JwtAuthGuard** — Validates token signature and expiry
2. **RolesGuard** — Checks `@Roles()` decorator against user role
3. **TenantGuard** — For `@TenantAware()` routes, validates user belongs to accessed tenant

Routes without `@Roles()` are accessible to any authenticated user. Routes with `@Public()` skip authentication entirely.

## Tenant Isolation

### Application-Level Filtering

Every database query for tenant-scoped resources includes `tenantId`:

```typescript
// Every service method filters by tenant
const policies = await this.prisma.policy.findMany({
  where: { tenantId: user.tenantId },
});
```

### Cross-Tenant Protection

- Tenant users can ONLY access their own tenant's data
- Super Admins can access any tenant's data
- The `TenantGuard` prevents unauthorized cross-tenant access
- URL-based tenant IDs are validated against the JWT's `tenantId`

### What is Isolated Per Tenant

- Users and roles
- Policies and policy logs
- AI request logs
- API keys
- Documents and embeddings
- Audit logs
- Notifications
- Webhooks
- File uploads

## API Key Security

### Encryption

Provider API keys (OpenAI, Anthropic, Gemini) are encrypted at rest:

- **Algorithm:** AES-256-CBC
- **Key derivation:** `crypto.scryptSync` with configurable secret
- **Storage format:** `iv_hex:encrypted_hex`
- **Display:** Only the first 8 characters shown in API responses (`sk-abc1****`)

### Management

- One key per provider per tenant (enforced by unique constraint)
- Keys can be toggled active/inactive
- Key rotation creates new encrypted value without downtime
- Deletion is permanent

## Input Validation

### Global Validation Pipe

```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,        // Strip unknown properties
  forbidNonWhitelisted: true,  // Reject unknown properties
  transform: true,        // Auto-transform types
}));
```

### DTO Validation

All request bodies are validated using `class-validator` decorators:
- Type checking (`@IsString()`, `@IsInt()`, etc.)
- Length limits (`@MaxLength()`, `@Max()`)
- Format validation (`@IsEmail()`, `@IsUUID()`)
- Enum validation (`@IsIn()`, `@IsEnum()`)

## Security Headers

**Helmet** middleware sets security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (when HTTPS)
- `Content-Security-Policy`

## Rate Limiting

- **Global:** 100 requests per 60 seconds per IP
- **Auth endpoints:** 10 requests per 60 seconds (stricter)
- Implemented via `@nestjs/throttler`
- Returns 429 Too Many Requests when exceeded

## Audit Trail

Every significant action is logged:

| Event Type | What's Logged |
|------------|---------------|
| Authentication | Login success/failure, logout, token refresh |
| CRUD Operations | Create, update, delete on all resources |
| Policy Evaluation | Every prompt evaluation with decision |
| AI Requests | Full request/response with tokens and latency |
| Security Events | Account lockout, password changes |
| Admin Actions | Tenant creation, user management, policy changes |

Audit logs include:
- User ID
- Tenant ID
- IP address
- User agent
- Request ID (for correlation)
- Timestamp
- Action metadata

## Sensitive Data Handling

### What's Redacted in Logs

The `LoggingInterceptor` redacts sensitive fields from request logging:
- `password`
- `currentPassword`
- `newPassword`
- `confirmPassword`
- `token`
- `refreshToken`

### Policy-Based Detection

The `SENSITIVE_DATA` policy type detects patterns in AI prompts:
- Social Security Numbers (SSN)
- Credit card numbers
- Email addresses
- Phone numbers

When detected, the request is denied BEFORE reaching the AI provider.

## Production Security Checklist

- [ ] Set strong, unique `JWT_SECRET` (64+ random characters)
- [ ] Set strong, unique `API_KEY_ENCRYPTION_SECRET`
- [ ] Enable HTTPS (terminate TLS at load balancer or reverse proxy)
- [ ] Set `NODE_ENV=production`
- [ ] Use managed PostgreSQL with SSL (`?sslmode=require`)
- [ ] Use managed Redis with authentication
- [ ] Set strict CORS origins (replace wildcard)
- [ ] Enable email verification for user registration
- [ ] Review and tune rate limiting thresholds
- [ ] Set up log aggregation and alerting
- [ ] Regular database backups
- [ ] Rotate JWT secrets and encryption keys periodically
- [ ] Monitor the security dashboard (`GET /api/v1/monitoring/security`)
