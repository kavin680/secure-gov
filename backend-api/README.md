# Enterprise Backend Framework

A production-ready, enterprise-grade backend framework built with **NestJS**, **Prisma**, **PostgreSQL**, and **Redis**. Designed as a cloneable platform: **Clone -> Configure -> Generate Resources -> Deploy**.

## Features

- **Authentication** - JWT access/refresh tokens, registration, login, email verification, password reset, session tracking
- **Authorization** - Role-based access control (RBAC), permissions guards, decorator-based protection
- **Response System** - Standardized API responses, pagination metadata, request IDs, environment-aware error handling
- **Exception Handling** - Global exception filter, custom error hierarchy, Prisma error mapping, production-safe errors
- **Logging** - Structured JSON logging with Pino, sensitive data redaction, correlation IDs
- **Audit System** - CRUD change tracking, security event logging, admin action audit trails
- **Database** - Prisma ORM, soft deletes, audit fields, seeders, pagination helpers, search/filter support
- **Caching** - Redis cache (optional), in-memory fallback, modular enable/disable
- **Mail** - Nodemailer integration, template support, optional enable/disable
- **Queue** - BullMQ job processing (optional), scheduled jobs ready
- **Security** - Helmet, CORS, rate limiting, bcrypt hashing, input validation
- **API Documentation** - Swagger/OpenAPI auto-generated docs
- **DevOps** - Docker, Docker Compose, GitHub Actions CI/CD, health checks, graceful shutdown
- **Generators** - Resource scaffolding script for rapid development
- **Testing** - Jest unit/e2e test infrastructure

## Quick Start

### Prerequisites

- Node.js 22+
- PostgreSQL 16+
- Redis 7+ (optional)
- Docker & Docker Compose (optional)

### Setup

```bash
# Clone the repository
git clone <repo-url> my-project
cd my-project

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Start development databases
npm run docker:dev

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:push

# Seed the database
npx prisma db seed

# Start development server
npm run start:dev
```

### Default Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@enterprise.com | Admin@123456 |
| User | user@enterprise.com | Admin@123456 |

### API Documentation

Once running, visit: `http://localhost:3000/docs`

## Project Structure

```
src/
├── common/                  # Shared infrastructure
│   ├── constants/           # App-wide constants
│   ├── decorators/          # Custom decorators (@Roles, @Public, @CurrentUser, @Audit)
│   ├── dtos/                # Shared DTOs (pagination)
│   ├── enums/               # Role, Permission, AuditAction enums
│   ├── filters/             # Global exception filter
│   ├── guards/              # Roles & permissions guards
│   ├── interceptors/        # Response, logging, audit interceptors
│   ├── interfaces/          # TypeScript interfaces
│   ├── middleware/           # Request ID middleware
│   ├── pipes/               # Custom validation pipe
│   └── utils/               # Utility functions (hash, pagination)
├── config/                  # Configuration modules (app, auth, db, redis, mail, queue)
├── database/                # Prisma service, module, helpers, seeds
├── modules/
│   ├── auth/                # Authentication (JWT, Passport, sessions)
│   ├── users/               # User management (CRUD, soft delete)
│   ├── health/              # Health check endpoints
│   ├── audit/               # Audit log management
│   ├── cache/               # Cache configuration module
│   ├── mail/                # Email service
│   ├── queue/               # Queue configuration module
│   └── logger/              # Pino logger module
├── app.module.ts            # Root application module
└── main.ts                  # Application bootstrap
prisma/
├── schema.prisma            # Database schema
└── migrations/              # Database migrations
scripts/
└── generate-resource.sh     # Resource generator
docker/                      # Docker configurations
docs/                        # Documentation
test/                        # E2E tests
.github/workflows/           # CI/CD pipelines
```

## API Response Format

### Success Response

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Success",
  "data": { ... },
  "requestId": "uuid",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Paginated Response

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Success",
  "data": [ ... ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false
  },
  "requestId": "uuid",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Error Response

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "errorCode": "VALIDATION_ERROR",
  "details": [ ... ],
  "requestId": "uuid",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/v1/users"
}
```

## Authentication Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/auth/register` | Register new user | Public |
| POST | `/api/v1/auth/login` | Login | Public |
| POST | `/api/v1/auth/logout` | Logout | Bearer |
| POST | `/api/v1/auth/refresh` | Refresh tokens | Public |
| POST | `/api/v1/auth/change-password` | Change password | Bearer |
| POST | `/api/v1/auth/forgot-password` | Request password reset | Public |
| POST | `/api/v1/auth/reset-password` | Reset password | Public |
| POST | `/api/v1/auth/verify-email` | Verify email | Public |
| GET  | `/api/v1/auth/sessions` | List active sessions | Bearer |
| DELETE | `/api/v1/auth/sessions/:id` | Revoke session | Bearer |
| GET  | `/api/v1/auth/me` | Get current user | Bearer |

## Generate Resources

```bash
# Generate a new CRUD resource
npm run generate:resource -- Product

# This creates:
# src/modules/products/
# ├── dto/
# │   ├── create-product.dto.ts
# │   ├── update-product.dto.ts
# │   └── index.ts
# ├── products.controller.ts
# ├── products.service.ts
# ├── products.module.ts
# └── products.service.spec.ts
```

## Docker

```bash
# Development (databases only)
npm run docker:dev

# Production (full stack)
npm run docker:up

# Build production image
npm run docker:build
```

## Configuration

All configuration is managed via environment variables with type-safe config modules. See `.env.example` for all available options.

| Module | Toggle | Description |
|--------|--------|-------------|
| Redis | `REDIS_ENABLED` | Enable/disable Redis cache |
| Mail | `MAIL_ENABLED` | Enable/disable email sending |
| Queue | `QUEUE_ENABLED` | Enable/disable BullMQ queues |
| Email Verification | `EMAIL_VERIFICATION_ENABLED` | Require email verification |

## Security

- **Helmet** - HTTP security headers
- **CORS** - Configurable cross-origin policy
- **Rate Limiting** - Throttler-based request limiting
- **Password Hashing** - bcrypt with configurable rounds
- **JWT** - Short-lived access tokens + refresh token rotation
- **Input Validation** - class-validator with whitelist mode
- **Soft Deletes** - Data preservation
- **Sensitive Data Redaction** - Passwords, tokens removed from logs
- **Account Locking** - Auto-lock after failed login attempts

## Scripts

| Script | Description |
|--------|-------------|
| `npm run start:dev` | Start in development mode |
| `npm run build` | Build for production |
| `npm run start:prod` | Start production build |
| `npm run lint` | Run ESLint |
| `npm run test` | Run unit tests |
| `npm run test:e2e` | Run E2E tests |
| `npm run test:cov` | Run tests with coverage |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Run database migrations |
| `npm run prisma:push` | Push schema to database |
| `npm run prisma:studio` | Open Prisma Studio |
| `npm run docker:dev` | Start dev databases |
| `npm run docker:up` | Start production stack |
| `npm run generate:resource` | Generate new resource |

## License

UNLICENSED
