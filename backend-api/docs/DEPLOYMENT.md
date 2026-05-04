# Deployment Guide

## Docker Production Deployment

### Build & Run
```bash
# Build the image
docker compose build

# Start all services
docker compose up -d

# Run migrations
docker compose exec app npx prisma migrate deploy

# Seed database (first time)
docker compose exec app npx prisma db seed
```

### Environment Variables
Set all required environment variables in `.env` or via Docker secrets:
- `JWT_SECRET` - Strong random secret for access tokens
- `JWT_REFRESH_SECRET` - Strong random secret for refresh tokens
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_HOST`, `REDIS_PORT` - Redis connection

### Health Checks
- `GET /api/health` - Full health check (database connectivity)
- `GET /api/health/ping` - Simple ping (uptime, timestamp)

## CI/CD (GitHub Actions)

The included workflow runs on push to `main`/`develop` and PRs:

1. **Lint & Build** - Runs ESLint and TypeScript compilation
2. **Test** - Runs unit and E2E tests with PostgreSQL service
3. **Docker Build** - Builds production Docker image (main branch only)

## Production Checklist

- [ ] Set strong JWT secrets
- [ ] Configure CORS origins
- [ ] Enable rate limiting
- [ ] Set `NODE_ENV=production`
- [ ] Configure database connection pooling
- [ ] Enable Redis for caching/queues
- [ ] Set up log aggregation
- [ ] Configure SSL/TLS termination
- [ ] Set up database backups
- [ ] Configure monitoring/alerting
