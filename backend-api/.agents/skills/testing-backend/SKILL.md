---
name: testing-backend
description: Test the NestJS backend API end-to-end. Use when verifying auth, multi-tenant, RBAC, or policy engine changes.
---

# Testing the Enterprise NestJS Backend

## Quick Start

1. Start Docker databases:
   ```bash
   cd /home/ubuntu/secure-gov/backend-api
   docker compose -f docker-compose.dev.yml up -d
   ```
2. Wait for PostgreSQL health check to pass (~10s)
3. Push Prisma schema and seed:
   ```bash
   npx prisma db push
   npx prisma db seed
   ```
4. Start dev server:
   ```bash
   npm run start:dev
   ```
5. Server runs on `http://localhost:3000`
6. Swagger UI at `http://localhost:3000/docs`

## Test Credentials (Seeded)

| Email | Password | Role | Tenant |
|---|---|---|---|
| admin@enterprise.com | Admin@123456 | SUPER_ADMIN | None (platform-level) |
| user@enterprise.com | Admin@123456 | USER | None |
| admin@acme.com | Admin@123456 | TENANT_ADMIN | Acme Corporation |
| user@acme.com | Admin@123456 | USER | Acme Corporation |
| dev@acme.com | Admin@123456 | DEVELOPER | Acme Corporation |
| admin@globetech.com | Admin@123456 | TENANT_ADMIN | GlobeTech Solutions |
| user@globetech.com | Admin@123456 | USER | GlobeTech Solutions |

## Key API Endpoints

### Public
- `GET /api/v1/health/ping` — Returns `{success: true, data: {status: "ok"}}`
- `GET /api/v1/health` — Includes database status
- `POST /api/v1/auth/login` — Returns accessToken + refreshToken + tenantId
- `POST /api/v1/auth/register` — Requires email, password, firstName, lastName

### Authenticated
- `GET /api/v1/auth/me` — Requires Bearer token
- `GET /api/v1/users` — ADMIN/TENANT_ADMIN only; tenant-scoped for TENANT_ADMIN

### Tenant Management (Super Admin Only)
- `GET /api/v1/tenants` — List all tenants with `_count.users`
- `GET /api/v1/tenants/:id` — Get tenant by ID
- `POST /api/v1/tenants` — Create tenant
- `PATCH /api/v1/tenants/:id` — Update tenant
- `DELETE /api/v1/tenants/:id` — Soft delete tenant

### Policy Engine (Tenant-Scoped)
- `GET /api/v1/policies` — List policies for user's tenant
- `POST /api/v1/policies` — Create policy
- `POST /api/v1/policies/evaluate` — Evaluate prompt against tenant policies
- `GET /api/v1/policies/stats` — Policy statistics

## Testing Multi-Tenant Isolation

1. Login as `admin@acme.com` to get a tenant-scoped token
2. `GET /users` should return ONLY Acme users (3 users)
3. Login as `admin@enterprise.com` (SUPER_ADMIN) 
4. `GET /users` should return ALL users (7+)
5. `GET /tenants` as TENANT_ADMIN should return 403 Forbidden

## Testing Policy Engine

Use `POST /api/v1/policies/evaluate` with a Bearer token:

| Prompt | Model | User | Expected |
|--------|-------|------|----------|
| `"What is my password?"` | (any) | Acme admin | DENIED (keyword block) |
| `"What is the weather today?"` | (any) | Acme admin | ALLOWED |
| `"hello"` | `claude-3` | Acme admin | DENIED (model not in allowlist) |
| `"hello"` | `gpt-4o` | Acme admin | ALLOWED |
| `"hello"` | `gpt-4o` | GlobeTech admin | DENIED (GlobeTech only allows gpt-4o-mini) |
| `"hello"` | `gpt-4o-mini` | GlobeTech admin | ALLOWED |

## Efficient Testing Tips

- **Use curl for speed**: Swagger UI interactions are slow due to heavy DOM. Use curl for bulk testing and Swagger for visual evidence screenshots.
- **Save tokens**: Login once per role and reuse the token for multiple requests. Tokens expire after 15 minutes.
- **Parallel requests**: Tests 4-7 (policy evaluation) are independent and can be run in parallel.

## RBAC Testing

- USER role gets 403 on `/api/v1/users` (admin-only endpoint)
- TENANT_ADMIN gets 403 on `/api/v1/tenants` (Super Admin only)
- SUPER_ADMIN can access all endpoints
- Test by logging in with different seeded accounts

## Swagger UI Testing

- Navigate to `http://localhost:3000/docs`
- Use "Authorize" button (top right) to set Bearer token
- Expected sections: Audit, Auth, Feature Flags, Files, Health, Notifications, Policies, Tenants, Users, Webhooks
- Use "Try it out" → "Execute" to test endpoints

## Known Gotchas

- **Cache module type errors**: If the cache module's `useFactory` returns a conditional/union type, TypeScript might reject it. Use a single `Record<string, unknown>` object.
- **Prisma version**: This project uses Prisma v5 (not v7). Check for schema syntax compatibility.
- **Optional services disabled**: Redis, Mail, Queue are all disabled in `.env`. The app runs fine without them.
- **Password validation**: Must contain uppercase, lowercase, number, and special character. Example: `Admin@123456`
- **JWT token expiry**: Access tokens expire in 15 minutes. Re-login if you get 401 errors during testing.
- **Rate limiting**: Login endpoint has a rate limit of 5 requests per minute. Space out login requests or wait between tests.
- **Seeded data**: Tenants are Acme Corporation (slug: `acme-corp`, maxUsers: 50) and GlobeTech Solutions (slug: `globetech`, maxUsers: 25).

## Devin Secrets Needed

No secrets are required for local testing. The `.env` file is generated from `.env.example` with default values. Docker databases use default credentials (postgres/password).
