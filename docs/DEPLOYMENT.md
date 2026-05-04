# Deployment Guide

## Prerequisites

- **Node.js** 22+ ([download](https://nodejs.org))
- **Docker** & Docker Compose ([download](https://docs.docker.com/get-docker/))
- **Git** ([download](https://git-scm.com))

## Local Development Setup

### 1. Clone and Install

```bash
git clone https://github.com/kavin680/secure-gov.git
cd secure-gov/backend-api
npm install
```

### 2. Start Infrastructure

Start PostgreSQL (with pgvector) and Redis:

```bash
docker compose -f docker-compose.dev.yml up -d
```

This starts:
- **PostgreSQL 16** with pgvector extension on port `5432`
- **Redis 7** on port `6379`

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your settings. Key variables:

```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/enterprise_db"

# JWT
JWT_SECRET="your-secret-key-change-in-production"
JWT_EXPIRATION="15m"
JWT_REFRESH_EXPIRATION="7d"

# App
PORT=3000
NODE_ENV=development

# Redis (optional — falls back to in-memory cache if unavailable)
REDIS_HOST=localhost
REDIS_PORT=6379

# API Key Encryption
API_KEY_ENCRYPTION_SECRET="your-encryption-secret-change-in-production"

# Mail (optional)
MAIL_ENABLED=false
```

### 4. Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Push schema to database (creates tables)
npx prisma db push

# Seed with demo data (tenants, users, policies)
npm run prisma:seed
```

### 5. Start Development Server

```bash
npm run start:dev
```

The server starts at `http://localhost:3000`.
Swagger API docs at `http://localhost:3000/docs`.

### 6. Verify It Works

```bash
# Login as Super Admin
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@enterprise.com","password":"Admin@123456"}'

# Use the returned accessToken for subsequent requests
export TOKEN="<accessToken from response>"

# Check health
curl http://localhost:3000/api/v1/health

# List tenants (Super Admin only)
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/tenants
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Start dev server with hot reload |
| `npm run build` | Build for production |
| `npm run start:prod` | Run production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run unit tests |
| `npm run test:e2e` | Run end-to-end tests |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:push` | Push schema to database |
| `npm run prisma:seed` | Seed database with demo data |
| `npm run prisma:studio` | Open Prisma Studio (database GUI) |
| `npm run docker:dev` | Start dev infrastructure |
| `npm run docker:dev:down` | Stop dev infrastructure |

## Production Deployment

### Build

```bash
cd backend-api
npm ci --production=false
npm run build
```

### Environment Variables (Production)

Set these in your production environment:

```env
NODE_ENV=production
PORT=3000

# Database — use a managed PostgreSQL with pgvector
DATABASE_URL="postgresql://user:pass@host:5432/dbname?sslmode=require"

# Security — generate strong random secrets
JWT_SECRET="<64-char random string>"
API_KEY_ENCRYPTION_SECRET="<64-char random string>"

# JWT
JWT_EXPIRATION="15m"
JWT_REFRESH_EXPIRATION="7d"

# Redis — use managed Redis
REDIS_HOST="redis-host"
REDIS_PORT=6379

# Mail
MAIL_ENABLED=true
MAIL_HOST="smtp.provider.com"
MAIL_PORT=587
MAIL_USER="user"
MAIL_PASS="pass"
MAIL_FROM="noreply@yourdomain.com"
```

### Run

```bash
node dist/main.js
```

### Docker Production Build

The project includes a multi-stage Dockerfile:

```bash
docker compose build
docker compose up -d
```

### Database Migration (Production)

For production, use Prisma migrations instead of `db push`:

```bash
# Create migration
npx prisma migrate dev --name init

# Apply in production
npx prisma migrate deploy
```

### pgvector Setup

The pgvector extension must be available in your PostgreSQL instance:

- **Docker:** Uses `pgvector/pgvector:pg16` image (included in docker-compose)
- **AWS RDS:** pgvector is available as an extension — enable it in the parameter group
- **Azure:** Available in Azure Database for PostgreSQL Flexible Server
- **Supabase:** pgvector is enabled by default

Enable the extension:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

## Health Check

```bash
curl http://localhost:3000/api/v1/health
```

Returns status of the application, database connection, and memory usage.

## Troubleshooting

### "Cannot find module '@prisma/client'"
```bash
npx prisma generate
```

### Database connection refused
```bash
# Check Docker containers are running
docker ps

# Restart if needed
docker compose -f docker-compose.dev.yml down
docker compose -f docker-compose.dev.yml up -d
```

### pgvector extension not available
Make sure you're using the `pgvector/pgvector:pg16` Docker image, not `postgres:16-alpine`.

### Seed data errors
```bash
# Reset database and re-seed
npx prisma db push --force-reset
npm run prisma:seed
```

### Redis connection warnings
Redis is optional. The app falls back to in-memory caching. To suppress warnings, either:
- Start Redis: `docker compose -f docker-compose.dev.yml up -d`
- Or set `CACHE_ENABLED=false` in `.env`
