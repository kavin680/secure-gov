# DTO (Data Transfer Object) Guide

## Overview

DTOs define the shape and validation rules for all incoming request data. Every endpoint that accepts a request body or query parameters uses a validated DTO. The framework uses [class-validator](https://github.com/typestack/class-validator) for constraint enforcement and [class-transformer](https://github.com/typestack/class-transformer) for type coercion. All DTOs are documented in Swagger via `@ApiProperty` / `@ApiPropertyOptional` decorators.

## How DTOs Work

```
Request → ValidationPipe → DTO Instance → Controller → Service
              │
              └── Invalid? → 400 "Validation failed" with field-level errors
```

- **Whitelist mode** is enabled globally — any properties not defined in the DTO are silently stripped.
- Validation errors return a structured response with a `details` array listing each failed constraint:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "details": [
    "email must be an email",
    "password must be longer than or equal to 8 characters"
  ]
}
```

---

## Shared DTOs

### PaginationQueryDto

**Location:** `src/common/dtos/pagination-query.dto.ts`

Base DTO for all paginated list endpoints. Extended by module-specific query DTOs.

| Field | Type | Required | Default | Constraints | Description |
|---|---|---|---|---|---|
| `page` | number | No | `1` | Min: 1, integer | Page number |
| `limit` | number | No | `20` | Min: 1, Max: 100, integer | Items per page |
| `search` | string | No | — | — | Free-text search query |
| `sortBy` | string | No | `createdAt` | — | Field to sort by |
| `sortOrder` | string | No | `desc` | `asc` or `desc` | Sort direction |

**Usage example:**
```
GET /api/v1/users?page=2&limit=10&search=john&sortBy=email&sortOrder=asc
```

**Response structure** (after response interceptor):
```json
{
  "success": true,
  "statusCode": 200,
  "data": [ ... ],
  "meta": {
    "page": 2,
    "limit": 10,
    "total": 45,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": true
  }
}
```

**Extending for module-specific filters:**
```typescript
import { PaginationQueryDto } from '../../../common/dtos';

export class AuditQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  action?: string;
}
```

---

## Auth DTOs

### RegisterDto

**Endpoint:** `POST /api/v1/auth/register`

| Field | Type | Required | Constraints | Example |
|---|---|---|---|---|
| `email` | string | Yes | Valid email format | `john@example.com` |
| `password` | string | Yes | 8-128 chars, must include uppercase, lowercase, number, and special char (`@$!%*?&`) | `SecureP@ss123` |
| `firstName` | string | Yes | Max 100 chars | `John` |
| `lastName` | string | Yes | Max 100 chars | `Doe` |

**Password regex:** `^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$`

**Example request:**
```json
{
  "email": "john@example.com",
  "password": "SecureP@ss123",
  "firstName": "John",
  "lastName": "Doe"
}
```

### LoginDto

**Endpoint:** `POST /api/v1/auth/login`

| Field | Type | Required | Constraints | Example |
|---|---|---|---|---|
| `email` | string | Yes | Valid email | `john@example.com` |
| `password` | string | Yes | Non-empty | `SecureP@ss123` |

### RefreshTokenDto

**Endpoint:** `POST /api/v1/auth/refresh`

| Field | Type | Required | Constraints | Example |
|---|---|---|---|---|
| `refreshToken` | string | Yes | Non-empty | `eyJhbGciOiJIUzI1NiIs...` |

### ChangePasswordDto

**Endpoint:** `POST /api/v1/auth/change-password` (Authenticated)

| Field | Type | Required | Constraints | Example |
|---|---|---|---|---|
| `currentPassword` | string | Yes | Non-empty | `OldP@ssw0rd` |
| `newPassword` | string | Yes | Same password rules as RegisterDto | `NewSecureP@ss123` |

### ForgotPasswordDto

**Endpoint:** `POST /api/v1/auth/forgot-password`

| Field | Type | Required | Constraints | Example |
|---|---|---|---|---|
| `email` | string | Yes | Valid email | `john@example.com` |

> **Note:** This endpoint always returns 200 regardless of whether the email exists — this prevents email enumeration attacks.

### ResetPasswordDto

**Endpoint:** `POST /api/v1/auth/reset-password`

| Field | Type | Required | Constraints | Example |
|---|---|---|---|---|
| `token` | string | Yes | Non-empty | `a1b2c3d4e5f6...` |
| `newPassword` | string | Yes | Same password rules as RegisterDto | `NewSecureP@ss123` |

### VerifyEmailDto

**Endpoint:** `POST /api/v1/auth/verify-email`

| Field | Type | Required | Constraints | Example |
|---|---|---|---|---|
| `token` | string | Yes | Non-empty | `a1b2c3d4e5f6...` |

---

## User DTOs

### CreateUserDto

**Endpoint:** `POST /api/v1/users` (Super Admin only)

| Field | Type | Required | Constraints | Example |
|---|---|---|---|---|
| `email` | string | Yes | Valid email | `john@example.com` |
| `password` | string | Yes | Same password rules as RegisterDto | `SecureP@ss123` |
| `firstName` | string | Yes | Max 100 chars | `John` |
| `lastName` | string | Yes | Max 100 chars | `Doe` |
| `role` | enum | No | `USER`, `ADMIN`, `SUPER_ADMIN` (default: `USER`) | `ADMIN` |

### UpdateUserDto

**Endpoint:** `PATCH /api/v1/users/:id` (Admin)

| Field | Type | Required | Constraints | Example |
|---|---|---|---|---|
| `firstName` | string | No | Max 100 chars | `John` |
| `lastName` | string | No | Max 100 chars | `Doe` |
| `role` | enum | No | `USER`, `ADMIN`, `SUPER_ADMIN` | `ADMIN` |
| `isActive` | boolean | No | — | `false` |

---

## Feature Flag DTOs

### CreateFeatureFlagDto

**Endpoint:** `POST /api/v1/feature-flags` (Super Admin)

| Field | Type | Required | Constraints | Example |
|---|---|---|---|---|
| `key` | string | Yes | Max 100 chars, kebab-case only (`^[a-z0-9-]+$`) | `enable-dark-mode` |
| `name` | string | Yes | Max 200 chars | `Dark Mode` |
| `description` | string | No | Max 500 chars | `Enable dark mode for all users` |
| `enabled` | boolean | No | Default: `false` | `true` |
| `metadata` | JSON | No | Arbitrary JSON | `{ "rolloutPercentage": 50 }` |

**Key validation:** Only lowercase letters, numbers, and hyphens are allowed. Examples:
- `enable-dark-mode` — valid
- `Enable_Dark_Mode` — invalid (uppercase and underscores)
- `feature-123` — valid

### UpdateFeatureFlagDto

**Endpoint:** `PATCH /api/v1/feature-flags/:id` (Admin)

| Field | Type | Required | Constraints | Example |
|---|---|---|---|---|
| `name` | string | No | Max 200 chars | `Dark Mode V2` |
| `description` | string | No | Max 500 chars | `Updated description` |
| `enabled` | boolean | No | — | `true` |
| `metadata` | JSON | No | Arbitrary JSON | `{ "rolloutPercentage": 75 }` |

> **Note:** The `key` field is immutable after creation — use the toggle endpoint to change `enabled` state.

---

## Notification DTOs

### CreateNotificationDto

**Endpoint:** `POST /api/v1/notifications` (Admin)

| Field | Type | Required | Constraints | Example |
|---|---|---|---|---|
| `userId` | string | Yes | Non-empty | `user-uuid` |
| `type` | string | Yes | Max 50 chars | `SYSTEM` |
| `title` | string | Yes | Max 200 chars | `Welcome!` |
| `message` | string | Yes | Max 2000 chars | `Welcome to the platform.` |
| `data` | JSON | No | Arbitrary JSON | `{ "link": "/dashboard" }` |

---

## Webhook DTOs

### CreateWebhookDto

**Endpoint:** `POST /api/v1/webhooks` (Admin)

| Field | Type | Required | Constraints | Example |
|---|---|---|---|---|
| `name` | string | Yes | Max 200 chars | `Order Events` |
| `url` | string | Yes | Valid URL | `https://example.com/webhook` |
| `events` | string[] | Yes | Array of event names | `["user.created", "user.updated"]` |
| `secret` | string | No | Auto-generated with `whsec_` prefix if omitted | `whsec_abc123...` |

**Event names** follow the `resource.action` pattern. Common events:
- `user.created`, `user.updated`, `user.deleted`
- `session.created`, `session.revoked`

### UpdateWebhookDto

**Endpoint:** `PATCH /api/v1/webhooks/:id` (Admin)

| Field | Type | Required | Constraints | Example |
|---|---|---|---|---|
| `name` | string | No | Max 200 chars | `Updated Webhook` |
| `url` | string | No | Valid URL | `https://example.com/webhook-v2` |
| `events` | string[] | No | Array of strings | `["user.created"]` |
| `isActive` | boolean | No | — | `false` |

---

## Query DTOs (Extend PaginationQueryDto)

### AuditQueryDto

**Endpoint:** `GET /api/v1/audit` (Admin)

Inherits all fields from `PaginationQueryDto` plus:

| Field | Type | Required | Constraints | Example |
|---|---|---|---|---|
| `action` | string | No | — | `CREATE`, `LOGIN`, `DELETE` |
| `resource` | string | No | — | `User`, `Session` |
| `userId` | string | No | — | `user-uuid` |

**Available audit actions:** `CREATE`, `UPDATE`, `DELETE`, `SOFT_DELETE`, `RESTORE`, `LOGIN`, `LOGOUT`, `LOGIN_FAILED`, `PASSWORD_CHANGE`, `PASSWORD_RESET`, `ROLE_CHANGE`, `PERMISSION_CHANGE`, `EMAIL_VERIFIED`, `ACCOUNT_LOCKED`, `ACCOUNT_UNLOCKED`

**Example:**
```
GET /api/v1/audit?action=LOGIN&resource=User&page=1&limit=20&sortOrder=desc
```

### FileQueryDto

**Endpoint:** `GET /api/v1/files` (Authenticated)

Inherits all fields from `PaginationQueryDto` plus:

| Field | Type | Required | Constraints | Example |
|---|---|---|---|---|
| `mimeType` | string | No | — | `image/png` |

**Example:**
```
GET /api/v1/files?mimeType=image/png&page=1&limit=10
```

---

## Internal DTOs

### CreateAuditLogDto (Interface)

**Used internally by the Audit system** — not exposed via API. Services create audit logs programmatically through the `@Audit()` decorator or `AuditService.log()`.

| Field | Type | Required | Description |
|---|---|---|---|
| `action` | AuditAction \| string | Yes | What happened |
| `resource` | string | Yes | What was affected |
| `resourceId` | string | No | ID of affected resource |
| `userId` | string | No | Who did it |
| `requestId` | string | No | Correlation ID |
| `description` | string | No | Human-readable description |
| `metadata` | object | No | Additional context data |
| `ipAddress` | string | No | Client IP |
| `userAgent` | string | No | Client user agent |

---

## Conventions & Patterns

### Password Rules

All password fields across the framework enforce the same regex:

```
^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$
```

- Minimum 8 characters, maximum 128
- At least one lowercase letter
- At least one uppercase letter
- At least one digit
- At least one special character (`@$!%*?&`)

DTOs that enforce this: `RegisterDto`, `CreateUserDto`, `ChangePasswordDto`, `ResetPasswordDto`

### Create vs Update DTOs

| Aspect | Create DTO | Update DTO |
|---|---|---|
| Fields | All required fields marked `@IsNotEmpty()` | All fields optional with `@IsOptional()` |
| Validation | Full validation on all fields | Validation only on provided fields |
| Swagger | Uses `@ApiProperty` | Uses `@ApiPropertyOptional` |
| Immutable fields | Accepts all fields | Excludes immutable fields (e.g., `key` in feature flags) |

### Adding a New DTO

1. Create the DTO class in `src/modules/<module>/dto/`:
```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateExampleDto {
  @ApiProperty({ example: 'Example value', description: 'Field description' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ example: 'Optional info' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
```

2. Export from the module's `dto/index.ts`:
```typescript
export { CreateExampleDto } from './create-example.dto';
```

3. Use in the controller:
```typescript
@Post()
create(@Body() dto: CreateExampleDto) {
  return this.exampleService.create(dto);
}
```

4. For list endpoints, extend `PaginationQueryDto`:
```typescript
import { PaginationQueryDto } from '../../../common/dtos';

export class ExampleQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  customFilter?: string;
}
```

### Error Codes Related to Validation

When DTOs reject input, the error response uses these codes:

| Code | Enum | Description |
|---|---|---|
| `VAL_001` | `ErrorCode.VALIDATION_ERROR` | General validation failure |
| `VAL_002` | `ErrorCode.INVALID_INPUT` | Invalid input format |
| `DB_002` | `ErrorCode.UNIQUE_CONSTRAINT` | Duplicate unique field (Prisma P2002) |
| `FILE_001` | `ErrorCode.FILE_TOO_LARGE` | File exceeds size limit |
| `FILE_002` | `ErrorCode.INVALID_FILE_TYPE` | MIME type not allowed |

### File Upload Constraints

File uploads use the `StorageService` which enforces these limits (defined in `APP_CONSTANTS.FILE_UPLOAD`):

- **Max size:** 10 MB
- **Allowed MIME types:** `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `application/pdf`, `text/csv`, `application/json`, `.xlsx`, `.docx`

---

## Complete DTO Map

| Module | DTO | Type | Endpoint |
|---|---|---|---|
| Common | `PaginationQueryDto` | Query | All list endpoints |
| Auth | `RegisterDto` | Body | `POST /auth/register` |
| Auth | `LoginDto` | Body | `POST /auth/login` |
| Auth | `RefreshTokenDto` | Body | `POST /auth/refresh` |
| Auth | `ChangePasswordDto` | Body | `POST /auth/change-password` |
| Auth | `ForgotPasswordDto` | Body | `POST /auth/forgot-password` |
| Auth | `ResetPasswordDto` | Body | `POST /auth/reset-password` |
| Auth | `VerifyEmailDto` | Body | `POST /auth/verify-email` |
| Users | `CreateUserDto` | Body | `POST /users` |
| Users | `UpdateUserDto` | Body | `PATCH /users/:id` |
| Feature Flags | `CreateFeatureFlagDto` | Body | `POST /feature-flags` |
| Feature Flags | `UpdateFeatureFlagDto` | Body | `PATCH /feature-flags/:id` |
| Notifications | `CreateNotificationDto` | Body | `POST /notifications` |
| Webhooks | `CreateWebhookDto` | Body | `POST /webhooks` |
| Webhooks | `UpdateWebhookDto` | Body | `PATCH /webhooks/:id` |
| Audit | `AuditQueryDto` | Query | `GET /audit` |
| Audit | `CreateAuditLogDto` | Internal | Service-level only |
| File Upload | `FileQueryDto` | Query | `GET /files` |

> All endpoints are prefixed with `/api/v1/`.
