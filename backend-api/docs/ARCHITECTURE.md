# Architecture Guide

## Overview

This framework follows a modular, layered architecture optimized for enterprise applications.

## Architecture Layers

```
┌─────────────────────────────────────────┐
│            API Layer (Controllers)       │
│  Routes, Swagger, Request Validation     │
├─────────────────────────────────────────┤
│         Business Logic (Services)        │
│  Domain Logic, Data Transformation       │
├─────────────────────────────────────────┤
│          Data Access (Prisma)            │
│  Database Queries, Transactions          │
├─────────────────────────────────────────┤
│        Infrastructure Layer              │
│  Config, Logging, Cache, Mail, Queue     │
├─────────────────────────────────────────┤
│          Common Layer                    │
│  Guards, Interceptors, Filters, DTOs     │
└─────────────────────────────────────────┘
```

## Request Lifecycle

1. **Request arrives** -> RequestIdMiddleware assigns unique ID
2. **Rate limiting** -> ThrottlerGuard checks limits
3. **Authentication** -> JwtAuthGuard validates token (unless @Public)
4. **Authorization** -> RolesGuard checks role permissions
5. **Validation** -> ValidationPipe validates request body
6. **Logging** -> LoggingInterceptor logs request details
7. **Controller** -> Handles route logic
8. **Service** -> Executes business logic
9. **Database** -> Prisma performs data operations
10. **Response** -> ResponseInterceptor wraps in standard format
11. **Audit** -> AuditInterceptor logs changes (if @Audit decorator)

## Module Types

### Infrastructure Modules (Global)
- `DatabaseModule` - Prisma ORM connection
- `AuditModule` - Audit logging
- `MailModule` - Email sending
- `AppLoggerModule` - Structured logging

### Feature Modules
- `AuthModule` - Authentication
- `UsersModule` - User management
- `HealthModule` - Health checks

### Config Modules
- Dynamic registration via `ConfigModule.forRoot()`
- Namespaced configs: `app.port`, `auth.jwtSecret`, `redis.host`

## Design Patterns

- **Repository Pattern** - Prisma service acts as the data access layer
- **Strategy Pattern** - Passport strategies for different auth methods
- **Decorator Pattern** - Custom decorators for metadata
- **Interceptor Pattern** - Cross-cutting concerns (logging, response wrapping)
- **Guard Pattern** - Authentication and authorization
- **Filter Pattern** - Exception handling

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files | kebab-case | `create-user.dto.ts` |
| Classes | PascalCase | `CreateUserDto` |
| Methods | camelCase | `findAll()` |
| Constants | UPPER_SNAKE_CASE | `APP_CONSTANTS` |
| Enums | PascalCase | `Role.ADMIN` |
| Decorators | PascalCase | `@CurrentUser()` |
| Config keys | dot notation | `auth.jwtSecret` |
| DB columns | snake_case | `created_at` |

## Expansion Guide

To add a new module:

1. Run `npm run generate:resource -- ModuleName`
2. Add the Prisma model to `prisma/schema.prisma`
3. Run `npx prisma migrate dev`
4. Import the module in `app.module.ts`
5. Add Swagger tags in `main.ts`
