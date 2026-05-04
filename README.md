# Secure Multi-Tenant AI Governance Platform

A web-based enterprise AI governance middleware platform with centralized security, policy enforcement, and controlled AI integration. Built as a final-year project prototype demonstrating how organizations can securely govern, monitor, and control AI usage across multiple tenants.

## What It Does

This platform acts as an **intermediary layer** between enterprise applications and external AI providers:

```
Enterprise App  -->  Governance Platform  -->  AI Provider (OpenAI/Claude/Gemini)
                     - Authenticate request
                     - Verify tenant
                     - Apply RBAC
                     - Enforce policies
                     - Log everything
                     - Return response
```

## Core Features

| Feature | Description |
|---------|-------------|
| **Multi-Tenant Architecture** | Shared platform with tenant-level isolation across all resources |
| **RBAC** | 4 roles: Super Admin, Tenant Admin, User, Developer |
| **Policy Engine** | Keyword blocking, model restriction, topic filtering, sensitive data detection |
| **AI Gateway** | Proxy to OpenAI, Claude, Gemini with built-in mock provider for testing |
| **RAG Module** | Document upload (PDF/DOCX/TXT), chunking, embeddings, vector search, context-aware chat |
| **Monitoring** | Dashboard, usage analytics, compliance reports, security alerts |
| **Audit Logging** | Every action tracked with user, tenant, IP, timestamp |
| **API Key Management** | Encrypted storage (AES-256-CBC), per-tenant, per-provider |

## Tech Stack

- **Backend:** NestJS 11, TypeScript, Node.js
- **Database:** PostgreSQL 16 + pgvector extension
- **ORM:** Prisma 5
- **Cache/Queue:** Redis 7, BullMQ
- **Auth:** JWT (access + refresh tokens), bcrypt, Passport.js
- **Docs:** Swagger/OpenAPI auto-generated
- **Infrastructure:** Docker, Docker Compose

## Quick Start

```bash
# Clone
git clone https://github.com/kavin680/secure-gov.git
cd secure-gov/backend-api

# Install
npm install

# Start databases (PostgreSQL with pgvector + Redis)
docker compose -f docker-compose.dev.yml up -d

# Copy env and configure
cp .env.example .env

# Setup database
npx prisma generate
npx prisma db push
npm run prisma:seed

# Run
npm run start:dev
```

API docs available at: **http://localhost:3000/docs**

## Test Accounts

| Role | Email | Password | Tenant |
|------|-------|----------|--------|
| Super Admin | admin@enterprise.com | Admin@123456 | None (platform-wide) |
| Tenant Admin | admin@acme.com | Admin@123456 | Acme Corporation |
| User | user@acme.com | Admin@123456 | Acme Corporation |
| Developer | dev@acme.com | Admin@123456 | Acme Corporation |
| Tenant Admin | admin@globetech.com | Admin@123456 | GlobeTech Solutions |
| User | user@globetech.com | Admin@123456 | GlobeTech Solutions |

## API Endpoints Overview

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/login` | Login and get JWT tokens |
| POST | `/api/v1/auth/register` | Register new user |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| POST | `/api/v1/auth/logout` | Logout and revoke session |

### Tenants (Super Admin)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/tenants` | Create tenant |
| GET | `/api/v1/tenants` | List all tenants |
| GET | `/api/v1/tenants/:id` | Get tenant details |
| PATCH | `/api/v1/tenants/:id` | Update tenant |
| DELETE | `/api/v1/tenants/:id` | Soft delete tenant |

### Policies
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/policies` | Create policy |
| GET | `/api/v1/policies` | List policies |
| POST | `/api/v1/policies/evaluate` | Test prompt against policies |
| PATCH | `/api/v1/policies/:id` | Update policy |
| POST | `/api/v1/policies/:id/toggle` | Enable/disable policy |

### AI Gateway
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/ai/chat` | Send chat through governance gateway |
| GET | `/api/v1/ai/providers` | List available AI providers |
| GET | `/api/v1/ai/logs` | View AI request audit logs |
| GET | `/api/v1/ai/usage` | Usage statistics |
| POST | `/api/v1/ai/api-keys` | Add provider API key |
| GET | `/api/v1/ai/api-keys` | List API keys (masked) |

### RAG (Document Intelligence)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/rag/documents` | Upload document for processing |
| GET | `/api/v1/rag/documents` | List tenant documents |
| GET | `/api/v1/rag/documents/:id` | Get document with chunks |
| DELETE | `/api/v1/rag/documents/:id` | Delete document |
| POST | `/api/v1/rag/search` | Semantic search across documents |
| POST | `/api/v1/rag/chat` | Chat with document context (RAG) |

### Monitoring & Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/monitoring/dashboard` | Dashboard overview |
| GET | `/api/v1/monitoring/usage` | AI usage report |
| GET | `/api/v1/monitoring/compliance` | Compliance report |
| GET | `/api/v1/monitoring/security` | Security report |
| GET | `/api/v1/monitoring/tenants/:id/report` | Per-tenant report |

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture Guide](docs/ARCHITECTURE.md) | System design, module structure, data flow |
| [API Guide](docs/API_GUIDE.md) | Complete API reference with request/response examples |
| [Deployment Guide](docs/DEPLOYMENT.md) | Setup, configuration, production deployment |
| [Database Guide](docs/DATABASE.md) | Schema documentation, models, relationships |
| [Security Guide](docs/SECURITY.md) | Security architecture, threat model, best practices |

## Project Structure

```
secure-gov/
├── backend-api/
│   ├── src/
│   │   ├── common/              # Guards, decorators, interceptors, filters
│   │   ├── config/              # Environment configuration
│   │   ├── database/            # Prisma service, seeds
│   │   └── modules/
│   │       ├── auth/            # JWT authentication
│   │       ├── users/           # User management
│   │       ├── tenants/         # Multi-tenant management
│   │       ├── policies/        # Policy engine
│   │       ├── ai-gateway/      # AI provider proxy
│   │       ├── rag/             # Document intelligence
│   │       ├── monitoring/      # Analytics & reporting
│   │       ├── audit/           # Audit logging
│   │       └── ...              # Health, cache, mail, etc.
│   ├── prisma/schema.prisma     # Database schema
│   ├── docker-compose.dev.yml   # Dev infrastructure
│   └── package.json
├── docs/                        # Documentation
└── README.md
```

## License

UNLICENSED — Academic project
