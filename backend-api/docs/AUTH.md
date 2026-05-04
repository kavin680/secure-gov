# Authentication & Authorization Guide

## Authentication Flow

### Registration
1. User submits email, password, firstName, lastName
2. Password is hashed with bcrypt (configurable rounds)
3. Email verification token is generated
4. User record is created with `isEmailVerified: false`

### Login
1. User submits email and password
2. System checks: account exists, is active, not locked
3. Password is verified against bcrypt hash
4. Failed attempts are tracked; account locks after 5 failures
5. On success: JWT access token + refresh token issued
6. Session record is created for refresh token tracking

### Token Refresh
1. Client sends expired access token's refresh token
2. System validates refresh token against session records
3. Old session is revoked (refresh token rotation)
4. New access + refresh tokens are issued

### Logout
1. Client sends refresh token (optional)
2. Specific session or all sessions are revoked

## Token Structure

### Access Token (JWT)
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "USER",
  "iat": 1234567890,
  "exp": 1234568790
}
```

### Refresh Token
- Stored in `sessions` table with expiration
- Supports token rotation (old tokens are revoked)

## Guards

### JwtAuthGuard
Applied globally. Validates JWT access token. Skip with `@Public()` decorator.

### RolesGuard
Applied globally. Checks user role against `@Roles()` decorator metadata.

### PermissionsGuard
Optional fine-grained permission checks via `@Permissions()` decorator.

## Security Features

- Password complexity enforcement (uppercase, lowercase, digit, special char)
- Account lockout after 5 failed login attempts (30 min cooldown)
- Refresh token rotation
- Session management (view/revoke active sessions)
- Email verification (optional)
- Password reset with expiring tokens
- Sensitive data redaction in logs
