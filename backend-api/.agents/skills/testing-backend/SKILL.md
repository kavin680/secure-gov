# Testing the Enterprise NestJS Backend

## Quick Start

1. Start Docker databases:
   ```bash
   cd /home/ubuntu/repos/backend
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

| Email | Password | Role |
|---|---|---|
| admin@enterprise.com | Admin@123456 | SUPER_ADMIN |
| user@enterprise.com | Admin@123456 | USER |

## Key API Endpoints

- `GET /api/v1/health/ping` — Public, returns `{success: true, data: {status: "ok"}}`
- `GET /api/v1/health` — Public, includes database status
- `POST /api/v1/auth/register` — Public, requires email, password, firstName, lastName
- `POST /api/v1/auth/login` — Public, returns accessToken + refreshToken
- `GET /api/v1/auth/me` — Requires Bearer token
- `POST /api/v1/auth/refresh` — Accepts refreshToken in body
- `GET /api/v1/users` — Requires ADMIN or SUPER_ADMIN role

## RBAC Testing

- USER role gets 403 on `/api/v1/users` (admin-only endpoint)
- SUPER_ADMIN can access all endpoints
- Test by logging in with different seeded accounts and using the returned accessToken

## Swagger UI Testing

- Navigate to `http://localhost:3000/docs`
- Use "Authorize" button (top right) to set Bearer token for protected endpoints
- Expected sections: Audit, Auth, Health, Users
- Use "Try it out" → "Execute" to test endpoints directly

## Known Gotchas

- **Cache module type errors**: If the cache module's `useFactory` returns a conditional/union type, TypeScript might reject it. The fix is to use a single `Record<string, unknown>` object and conditionally add properties rather than returning different object shapes.
- **Prisma version**: This project uses Prisma v5 (not v7). If you see schema syntax errors about `datasource url`, check the Prisma version.
- **Optional services disabled by default**: Redis (`REDIS_ENABLED=false`), Mail (`MAIL_ENABLED=false`), Queue (`QUEUE_ENABLED=false`) are all disabled in `.env`. The app runs fine without them.
- **GitHub Actions CI workflow**: Located at `docs/ci-workflow.yml` (not `.github/workflows/`) due to OAuth scope limitations. Must be copied manually.
- **Password validation**: Passwords must contain uppercase, lowercase, number, and special character. Example valid password: `Test@12345`

## Devin Secrets Needed

No secrets are required for local testing. The `.env` file is generated from `.env.example` with default values. Docker databases use default credentials (postgres/password).
