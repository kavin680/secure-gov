# Architecture Guide

## System Overview

The Secure Multi-Tenant AI Governance Platform is a single NestJS monolith that acts as middleware between enterprise applications and AI providers. It enforces governance policies, manages multi-tenant isolation, and provides comprehensive audit logging.

```
┌─────────────────┐     ┌──────────────────────────────────────────────────┐     ┌─────────────────┐
│                 │     │           Governance Platform                    │     │                 │
│   Enterprise    │────▶│  Auth ──▶ Tenant ──▶ RBAC ──▶ Policy ──▶ Route  │────▶│   AI Provider   │
│   Application   │◀────│  Log  ◀── Response ◀── Transform ◀── Forward    │◀────│  (OpenAI, etc)  │
│                 │     │                                                  │     │                 │
└─────────────────┘     └──────────────────────────────────────────────────┘     └─────────────────┘
                              │         │          │           │
                              ▼         ▼          ▼           ▼
                         ┌─────────┐ ┌──────┐ ┌────────┐ ┌──────────┐
                         │PostgreSQL│ │Redis │ │pgvector│ │ Audit    │
                         │  (data) │ │(cache)│ │ (RAG)  │ │  Logs    │
                         └─────────┘ └──────┘ └────────┘ └──────────┘
```

## Design Principles

1. **Single Database, Single Backend** — All data (tenants, policies, AI logs, document embeddings) lives in one PostgreSQL database with pgvector extension. No microservices complexity.

2. **Application-Level Tenant Isolation** — Every query includes `tenantId` filtering. Not using Row-Level Security (RLS) — simpler to implement and debug with Prisma ORM.

3. **Policy-First AI Access** — Every AI request is evaluated against tenant policies BEFORE being forwarded to the provider. Denied requests are logged but never reach the AI provider.

4. **Module Boundaries** — NestJS modules provide clean separation of concerns. Each module has its own controller, service, DTOs, and can be independently tested.

## Module Architecture

```
AppModule
├── AuthModule              # JWT authentication, sessions, Passport strategies
├── UsersModule             # User CRUD, profile management
├── TenantsModule           # Tenant CRUD, user management, statistics
├── PoliciesModule          # Policy CRUD, rule evaluation engine
│   └── PolicyEvaluationService  # Evaluates prompts against tenant policies
├── AiGatewayModule         # AI provider proxy, API key management
│   ├── OpenAiProvider      # OpenAI GPT models
│   ├── AnthropicProvider   # Claude models
│   ├── GeminiProvider      # Google Gemini models
│   └── MockAiProvider      # Built-in mock for testing
├── RagModule               # Document processing, embeddings, retrieval
│   ├── DocumentProcessingService  # PDF/DOCX/TXT text extraction, chunking
│   ├── EmbeddingService    # Vector generation (OpenAI or mock)
│   └── RagService          # Orchestration: upload → chunk → embed → search → chat
├── MonitoringModule        # Analytics dashboards, usage/compliance/security reports
├── AuditModule             # Audit log queries and management
├── HealthModule            # Health check endpoints
├── CacheConfigModule       # Redis cache configuration
├── MailModule              # Email service (Nodemailer)
├── AppLoggerModule         # Structured logging (Pino)
└── CommonModule            # StorageService (file system storage)
```

## Request Lifecycle

### Standard API Request

```
1. RequestIdMiddleware     → Assigns UUID to request
2. JwtAuthGuard           → Validates JWT token, extracts user
3. RolesGuard             → Checks user role against @Roles() decorator
4. TenantGuard            → Validates tenant access for @TenantAware() routes
5. ThrottlerGuard         → Rate limiting
6. ValidationPipe         → DTO validation (whitelist, transform)
7. Controller             → Route handler
8. Service                → Business logic
9. ResponseInterceptor    → Wraps response in standard format
10. LoggingInterceptor    → Logs request/response metadata
```

### AI Chat Request Flow

```
1. Standard guards (JWT, Roles, Tenant, Throttler)
2. AiGatewayController.chat()
3. AiGatewayService.chat():
   a. Extract user prompt from messages
   b. PolicyEvaluationService.evaluate(prompt, model, tenantId)
      - Loads active policies for tenant, sorted by priority
      - Evaluates each policy type:
        * KEYWORD_BLOCK: Check for blocked words/phrases
        * MODEL_RESTRICT: Check model allowlist
        * TOPIC_RESTRICT: Check for restricted topics
        * SENSITIVE_DATA: Regex patterns (SSN, credit card, etc.)
      - Returns ALLOWED or DENIED with reason
   c. If DENIED → Log as DENIED, return 403
   d. If ALLOWED → Get API key for provider
   e. Forward to provider (OpenAI/Claude/Gemini/Mock)
   f. Log full interaction (prompt, response, tokens, latency, policy decision)
   g. Return response with usage stats
```

### RAG Chat Request Flow

```
1. Standard guards
2. RagController.ragChat()
3. RagService.ragChat():
   a. Generate embedding for user's question
   b. Search pgvector for similar document chunks (tenant-scoped)
   c. Assemble context from top-K chunks
   d. Build system prompt with document context
   e. Forward to AiGatewayService.chat() (includes policy evaluation)
   f. Return AI response + source documents with similarity scores
```

## Data Flow

### Multi-Tenant Isolation

Every database query is scoped by `tenantId`:

```typescript
// Service method pattern
async findAll(tenantId: string) {
  return this.prisma.policy.findMany({
    where: { tenantId },  // Always filtered
  });
}
```

JWT tokens include `tenantId` for tenant users. Super Admins have `tenantId: null` and can access cross-tenant data.

### Policy Evaluation Pipeline

```
Policies loaded per tenant (sorted by priority)
     │
     ▼
┌─────────────┐   ┌──────────────┐   ┌───────────────┐   ┌────────────────┐
│  KEYWORD    │──▶│   MODEL      │──▶│    TOPIC      │──▶│  SENSITIVE     │
│  BLOCK      │   │  RESTRICT    │   │   RESTRICT    │   │    DATA        │
│             │   │              │   │               │   │                │
│ Check for   │   │ Verify model │   │ Check topic   │   │ Regex patterns │
│ blocked     │   │ is in allow  │   │ keywords      │   │ for SSN, CC,   │
│ words       │   │ list         │   │               │   │ email, phone   │
└─────────────┘   └──────────────┘   └───────────────┘   └────────────────┘
     │                  │                   │                    │
     ▼                  ▼                   ▼                    ▼
   DENY if            DENY if            DENY if              DENY if
   match found        model not          topic match          pattern match
                      in list            found                found
```

### Document Processing Pipeline (RAG)

```
Upload (PDF/DOCX/TXT)
     │
     ▼
┌────────────────┐
│ Store file     │  StorageService → local filesystem
│ Create record  │  Document status = PENDING
└───────┬────────┘
        │ (async background)
        ▼
┌────────────────┐
│ Extract text   │  pdf-parse (PDF), mammoth (DOCX), fs (TXT)
│ Status =       │
│ PROCESSING     │
└───────┬────────┘
        ▼
┌────────────────┐
│ Chunk text     │  ~1500 chars per chunk, 200 char overlap
└───────┬────────┘
        ▼
┌────────────────┐
│ Generate       │  OpenAI text-embedding-3-small (1536 dims)
│ embeddings     │  or deterministic mock embeddings
└───────┬────────┘
        ▼
┌────────────────┐
│ Store in       │  pgvector column on document_chunks table
│ pgvector       │  Status = COMPLETED
└────────────────┘
```

## Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | Monolith | Simpler for prototype; NestJS modules provide logical separation |
| Tenant isolation | Application-level | Simpler than RLS with Prisma; sufficient for prototype |
| Vector DB | pgvector | Same PostgreSQL instance; no extra infrastructure |
| Policy storage | JSON in PostgreSQL | Flexible rules without schema changes |
| API key encryption | AES-256-CBC | Industry standard; keys encrypted at rest |
| Auth | JWT + refresh tokens | Stateless auth with session management |
| File storage | Local filesystem | Simple for prototype; can swap to S3 |
| Embeddings | OpenAI / Mock | Real embeddings when API key available; mock for testing |
