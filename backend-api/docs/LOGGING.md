# Logging & Audit Guide

## System Logging

Uses **Pino** for structured JSON logging with automatic sensitive data redaction.

### Log Levels
- `fatal` - Application crash
- `error` - Errors requiring attention
- `warn` - Potential issues
- `info` - General operational info (default production)
- `debug` - Detailed debug info (default development)
- `trace` - Very detailed tracing

### Configuration
```env
LOG_LEVEL=info  # Set minimum log level
```

### Redacted Fields
The following request fields are automatically redacted:
- `req.headers.authorization`
- `req.headers.cookie`
- `req.body.password`
- `req.body.currentPassword`
- `req.body.newPassword`
- `req.body.token`
- `req.body.refreshToken`

### Request Logging
Every request is logged with:
- Request ID (UUID)
- HTTP method and URL
- Client IP and user agent
- Response status code
- Response time (ms)

## Audit Logging

### Audit Events
The audit system tracks:
- **CRUD Changes** - Create, update, delete operations
- **Auth Events** - Login, logout, failed login attempts
- **Security Events** - Password changes, account locks
- **Admin Actions** - Role changes, user management

### Using the @Audit Decorator
```typescript
@Post()
@Audit({
  action: AuditAction.CREATE,
  resource: 'Product',
  description: 'Created a new product',
})
create(@Body() dto: CreateProductDto) {
  return this.service.create(dto);
}
```

### Querying Audit Logs
```
GET /api/v1/audit?action=CREATE&resource=User&page=1&limit=20
```
