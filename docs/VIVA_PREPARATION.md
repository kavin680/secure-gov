# Viva Preparation Guide

## Secure Multi-Tenant AI Governance Platform

This document contains anticipated viva questions organized by category, with detailed answers and key points to emphasize.

---

## 1. Project Overview and Motivation

### Q1: What problem does your project solve?

**Answer:**
Organizations adopting AI services across multiple departments face three core risks: data leakage (employees sending sensitive information to external AI providers), compliance gaps (no audit trail of AI interactions), and cost overruns (uncontrolled API usage). My platform acts as a controlled intermediary — every AI request passes through a governance layer that authenticates the user, validates their tenant context, evaluates the prompt against configurable policies, and logs the entire interaction before forwarding to the AI provider.

**Key points to emphasize:**
- The platform is provider-agnostic — works with OpenAI, Claude, and Gemini
- Multi-tenant architecture means multiple organizations can share a single platform instance with complete data isolation
- Policy enforcement happens *before* the request reaches the AI provider, not after

### Q2: Why is this project relevant now?

**Answer:**
The EU AI Act (2024) establishes legal requirements for AI risk management and transparency. NIST published the AI Risk Management Framework in 2023. Organizations need technical solutions to meet these regulatory requirements. Existing solutions (AWS Bedrock Guardrails, Azure AI Content Safety) are cloud-provider-specific and don't support multi-tenant deployments. My project fills this gap with a self-hosted, open-source, multi-tenant platform.

### Q3: Who are the target users?

**Answer:**
Five stakeholder roles:
1. **Super Admins** — Platform operators managing all tenants
2. **Tenant Admins** — Organization administrators managing their users and policies
3. **Developers** — Technical users uploading documents and using the AI gateway
4. **End Users** — Business users chatting with AI within their tenant's policy constraints
5. **Compliance Officers** — Auditors reviewing audit trails and compliance reports

### Q4: How does your project differ from existing solutions?

**Answer:**
Three key differentiators:
1. **Multi-tenant** — AWS Bedrock and Azure AI Safety are single-tenant; my platform isolates multiple organizations on shared infrastructure
2. **Self-hosted** — Organizations retain full control over their data; no dependency on a specific cloud provider
3. **Built-in RAG** — Document-grounded AI responses are integrated into the governance layer, not a separate service

---

## 2. Architecture and Design Decisions

### Q5: Why did you choose a modular monolith over microservices?

**Answer:**
For a prototype, a monolith reduces operational complexity — single deployment, single database, no inter-service communication overhead. However, I specifically used NestJS modules to maintain clean boundaries between domains (auth, policies, AI gateway, RAG, monitoring). Each module has its own controller, service, and DTOs. If horizontal scaling were needed, these modules could be extracted into independent services with minimal refactoring because the dependency injection boundaries are already established.

**If pressed:** "The trade-off is that all modules share a single process and failure domain. A crash in the RAG document processing could theoretically affect the AI gateway. In production, I'd mitigate this by running document processing as a separate worker process via BullMQ, which I've already implemented."

### Q6: Why PostgreSQL with pgvector instead of a dedicated vector database?

**Answer:**
Three reasons:
1. **Operational simplicity** — One database for relational data AND vector search. No need to manage Pinecone, Weaviate, or Qdrant separately.
2. **Tenant isolation** — Vector searches are scoped by `tenantId` using standard SQL WHERE clauses. With a separate vector DB, I'd need to implement tenant isolation in two systems.
3. **Transactional consistency** — Document chunks, metadata, and embeddings are all in one transaction. No eventual consistency issues between systems.

**Trade-off:** For very large-scale deployments (millions of vectors per tenant), a dedicated vector DB might perform better. But for this prototype's scale, pgvector is performant and significantly simpler.

### Q7: Why application-level tenant isolation instead of PostgreSQL Row-Level Security (RLS)?

**Answer:**
Prisma ORM does not natively support RLS policies. Implementing RLS would require raw SQL for policy management and would bypass Prisma's type-safe query builder. Application-level filtering is simpler to implement, debug, and test — every query includes `where: { tenantId }` which is validated by the `TenantGuard` middleware.

**Trade-off:** RLS provides an additional security layer at the database level, meaning even a bug in application code can't leak data across tenants. In a production system, I'd recommend adding RLS as a defense-in-depth measure alongside application filtering.

### Q8: Why JWT tokens instead of session-based authentication?

**Answer:**
JWT is stateless — the server doesn't need to look up a session store for every request. This is ideal for API-first architectures where the frontend is a separate application. I implemented refresh token rotation to mitigate the risk of token theft: each refresh issues a new token pair and revokes the old refresh token in the database.

**Key detail:** Access tokens are short-lived (15 minutes) to minimize the window of exposure if compromised. Refresh tokens (7 days) are stored in the database with session tracking, so they can be explicitly revoked on logout.

### Q9: Explain the request lifecycle through the platform.

**Answer:**
Ten steps for every request:
1. **RequestIdMiddleware** assigns a UUID for tracing
2. **JwtAuthGuard** validates the token signature and expiry
3. **RolesGuard** checks the user's role against the `@Roles()` decorator
4. **TenantGuard** validates tenant access for tenant-aware routes
5. **ThrottlerGuard** applies rate limiting (global or per-tenant tier)
6. **ValidationPipe** validates request body against DTOs (whitelist mode rejects unknown properties)
7. **Controller** routes to the appropriate handler
8. **Service** executes business logic
9. **ResponseInterceptor** wraps the response in a standard format with metadata
10. **LoggingInterceptor** logs request/response with timing

For AI requests, step 8 includes policy evaluation, API key decryption, provider forwarding, and interaction logging.

---

## 3. Implementation Details

### Q10: How does the policy engine work?

**Answer:**
The `PolicyEvaluationService` loads all active policies for the tenant, sorted by priority (lower number = higher priority). It evaluates each policy sequentially:

- **KEYWORD_BLOCK** — Checks if the prompt contains any blocked keywords (case-insensitive substring matching)
- **MODEL_RESTRICT** — Validates the requested model is in the tenant's allowlist
- **TOPIC_RESTRICT** — Scans for restricted topic keywords
- **SENSITIVE_DATA** — Applies regex patterns for SSN, credit card numbers, email addresses, and phone numbers
- **RATE_LIMIT** — Counts requests in the time window against the configured limit
- **USAGE_QUOTA** — Tracks token usage against daily/monthly quotas

The first DENY stops evaluation immediately. Every evaluation produces a `PolicyLog` record.

### Q11: Walk me through the RAG pipeline.

**Answer:**
Four stages:

1. **Upload:** User uploads PDF/DOCX/TXT (max 10MB). The file is stored via `StorageService` (local or S3). A `Document` record is created with status PENDING.

2. **Processing (async via BullMQ):** A background worker extracts text using pdf-parse (PDF), mammoth (DOCX), or direct file reading (TXT). The text is split into chunks of ~1500 characters with 200-character overlap to maintain context across boundaries.

3. **Embedding:** Each chunk is sent to OpenAI's text-embedding-3-small model, which returns a 1536-dimensional vector. In test mode, deterministic mock embeddings are generated. Vectors are stored in pgvector's `vector(1536)` column on the `DocumentChunk` table.

4. **Retrieval:** When a user asks a question, the question is embedded using the same model. pgvector's cosine distance operator (`<=>`) finds the top-K most similar chunks *within the user's tenant*. These chunks are assembled into a system prompt and forwarded to the AI gateway (which still applies policy enforcement).

### Q12: How do you encrypt API keys?

**Answer:**
Provider API keys are encrypted using AES-256-CBC:
1. A random 16-byte IV is generated for each encryption
2. The key is derived from a configurable secret using `crypto.scryptSync`
3. The encrypted format is `iv_hex:ciphertext_hex`
4. In API responses, keys are masked showing only the first 8 characters (e.g., `sk-abc1****`)
5. Decryption only happens at the moment of forwarding a request to the AI provider

### Q13: How does WebSocket notification delivery work?

**Answer:**
The `NotificationsGateway` uses Socket.IO with JWT authentication:
1. Client connects with a JWT token in the handshake
2. Gateway validates the token using `JwtService.verify()`
3. If valid, the client is automatically joined to `user:{userId}` and `tenant:{tenantId}` rooms
4. When a notification is created, `gateway.sendToUser()` emits to the user's room
5. For tenant-wide broadcasts, `gateway.sendToTenant()` emits to the tenant room
6. On disconnect, the client is automatically removed from rooms

### Q14: How is rate limiting implemented per tenant tier?

**Answer:**
The `TenantThrottlerGuard` extends NestJS's `ThrottlerGuard`:
1. On each request, it extracts the `tenantId` from the authenticated user
2. Looks up the tenant's tier from the database (FREE, STARTER, PROFESSIONAL, ENTERPRISE)
3. Maps the tier to rate limits: FREE → 30/min, STARTER → 100/min, PROFESSIONAL → 500/min, ENTERPRISE → 2000/min
4. Uses the throttler's built-in tracking mechanism to count requests against the tenant-specific limit
5. Returns 429 Too Many Requests when exceeded

---

## 4. Security

### Q15: How do you prevent cross-tenant data access?

**Answer:**
Three layers:
1. **JWT tokens** contain the user's `tenantId`, set at authentication time
2. **TenantGuard** validates that the authenticated user's tenant matches the requested resource's tenant
3. **Service-level filtering** — every database query includes `where: { tenantId }`, ensuring even if the guard were bypassed, the query would return no data from other tenants

For Super Admins, the `tenantId` is null and the TenantGuard is skipped, allowing platform-wide access.

### Q16: What happens if someone tries to brute-force a login?

**Answer:**
After 5 consecutive failed login attempts, the account is locked for 30 minutes (configurable). The `loginAttempts` counter is stored on the user record and checked before password validation. On successful login, the counter resets to zero. The lockout timestamp (`lockedUntil`) is checked on every login attempt, and locked accounts receive a 401 response with a message indicating the account is locked.

### Q17: How do you handle SQL injection?

**Answer:**
Prisma ORM uses parameterized queries by default — user input is never interpolated into SQL strings. Additionally, the `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true` strips unknown properties from request bodies, preventing injection via unexpected fields. For the one raw SQL query used in pgvector similarity search, I use Prisma's `$queryRawUnsafe` with parameterized values.

### Q18: What security headers does the application set?

**Answer:**
Helmet middleware configures:
- `X-Content-Type-Options: nosniff` — prevents MIME type sniffing
- `X-Frame-Options: DENY` — prevents clickjacking
- `X-XSS-Protection: 1; mode=block` — enables browser XSS filtering
- `Strict-Transport-Security` — enforces HTTPS (when behind TLS)
- `Content-Security-Policy` — restricts resource loading sources

---

## 5. Testing

### Q19: Describe your testing strategy.

**Answer:**
Three levels:
1. **Unit tests (201 tests, 19 suites):** Each service is tested in isolation. Dependencies (PrismaService, ConfigService, etc.) are mocked using Jest. Tests cover happy paths, error cases, edge cases, and security scenarios.
2. **API endpoint testing:** All endpoints verified via curl and Swagger, testing request/response formats, status codes, and error handling.
3. **Frontend testing:** Manual verification of all 14 pages, form submissions, API integration, and role-based navigation.

Key coverage: TenantsService 100%, MonitoringService 100%, UsersService 97%, AuthService 95%, RAG 90%.

### Q20: How do you test without real AI API keys?

**Answer:**
The platform includes a `MockAiProvider` that returns deterministic responses without making external API calls. Tests can use `provider: 'mock'` to exercise the full AI gateway pipeline (policy evaluation → provider selection → response logging) without incurring API costs or requiring internet access. For embeddings, the mock provider generates deterministic 1536-dimensional vectors based on a hash of the input text.

### Q21: What would you test differently if you had more time?

**Answer:**
1. **E2E integration tests** with a real database — testing the full stack from HTTP request to database to response
2. **Load testing** with k6 or Artillery — verifying performance under concurrent tenant load
3. **Chaos testing** — simulating database/Redis failures to verify graceful degradation
4. **Security penetration testing** — automated scanning with tools like OWASP ZAP

---

## 6. Challenges and Problem-Solving

### Q22: What was the most challenging part of the project?

**Answer:**
Implementing tenant-scoped vector similarity search. The challenge was ensuring that pgvector's cosine distance search respects tenant boundaries — a user in Tenant A should never see document chunks from Tenant B, even if those chunks are the most similar. The solution was to include `tenantId` as a filter in the raw SQL query alongside the vector operation, using pgvector's `<=>` operator for distance calculation and a WHERE clause for tenant filtering. This required careful SQL construction since Prisma doesn't natively support pgvector operators.

### Q23: Were there any significant bugs you had to fix?

**Answer:**
1. **Double API prefix bug** — Controllers were decorated with `@Controller('api/v1/rag')` but the app also had a global prefix `api` and URI versioning `v1`. This caused routes to be mapped as `/api/api/v1/rag/...`. Fixed by simplifying decorators to just the resource name (e.g., `@Controller('rag')`).

2. **Frontend-backend integration issues** — Five frontend pages had incorrect API calls: wrong endpoints, missing required fields, incorrect field names. Systematically identified by testing each page against the backend and tracing 400/404 errors.

### Q24: How did you manage the complexity of the project?

**Answer:**
1. **Phased development** — 12 implementation phases with clear deliverables, tracked in DEVELOPMENT_FLOW.md
2. **Module boundaries** — NestJS modules enforced separation of concerns; each module could be developed and tested independently
3. **Schema-driven development** — Prisma schema defined the data model first, then services were built to match
4. **Comprehensive documentation** — Architecture, Security, Database, Deployment, and API guides written alongside implementation

---

## 7. Evaluation and Reflection

### Q25: What are the main limitations of your project?

**Answer:**
1. **No output filtering** — Policies only evaluate inputs (prompts). AI responses could contain sensitive information that should be filtered.
2. **No enterprise SSO** — SAML and OIDC integration is needed for real enterprise deployments.
3. **Application-level isolation only** — Database RLS would add a second layer of tenant protection.
4. **No load testing** — Performance under high concurrency hasn't been validated.
5. **Embedding model dependency** — RAG requires OpenAI's API for real embeddings; no local model option.

### Q26: If you started over, what would you do differently?

**Answer:**
1. **Start with E2E tests** — Having integration tests from the beginning would have caught the controller route prefix bug earlier
2. **Add database RLS** — Even though Prisma doesn't natively support it, I'd add RLS policies via raw migrations as a defense-in-depth measure
3. **Implement output filtering** — Scanning AI responses for policy violations is equally important as input filtering
4. **Use a monorepo tool** — Something like Nx or Turborepo to manage the backend and frontend in one workspace with shared types

### Q27: How would you scale this for production?

**Answer:**
1. **Horizontal scaling** — Run multiple app instances behind a load balancer (already supported by the production Docker Compose with configurable replicas)
2. **Database read replicas** — Route read-heavy monitoring queries to replicas
3. **Dedicated vector service** — If embedding volumes exceed pgvector's capacity, extract to Qdrant or Pinecone
4. **CDN for file storage** — Already configured with S3 + CloudFront CDN URL support
5. **Queue scaling** — BullMQ workers can run as separate processes/containers for document processing
6. **Redis cluster** — Upgrade from single-node Redis to a cluster for cache and queue reliability

### Q28: What did you learn from this project?

**Answer:**
1. **Module boundaries matter** — Clean separation early saves significant refactoring later
2. **Prisma is powerful but has limits** — Great for standard queries, but raw SQL is needed for pgvector operations and advanced features like RLS
3. **Policy-first design** — Building the governance layer before the AI gateway ensured security was foundational, not bolted on
4. **Multi-tenancy is pervasive** — Every feature, query, and test must account for tenant context; it's not something you add later
5. **Testing with mocks is essential** — The mock AI provider enabled full pipeline testing without API costs or external dependencies

---

## 8. Technical Deep Dives (Advanced Questions)

### Q29: How would you add prompt injection detection?

**Answer:**
Two approaches:
1. **Classifier-based** — Train or use a pre-trained model to classify prompts as normal/malicious. This could be added as a new policy type (PROMPT_INJECTION) in the policy engine. The classifier would score each prompt and deny requests above a confidence threshold.
2. **Pattern-based** — Add regex patterns to the SENSITIVE_DATA policy type for known injection patterns (e.g., "ignore previous instructions", "you are now", system prompt extraction attempts).

I'd recommend the classifier approach for production, integrated as a service called by the PolicyEvaluationService before forwarding to the AI provider.

### Q30: How does the audit system maintain data integrity?

**Answer:**
The `AuditInterceptor` runs in NestJS's interceptor pipeline — after the request is processed but before the response is sent. It captures:
- The HTTP method, URL, and user identity
- The response status and any error messages
- Timing information
- The client IP address

Audit records are immutable — there are no update or delete endpoints for audit logs. They can only be queried. In production, these would be streamed to an external log aggregation service (Datadog/ELK) for tamper-proof storage.

### Q31: Explain the embedding generation process in detail.

**Answer:**
When a document is uploaded:
1. Text extraction produces a single string (potentially thousands of characters)
2. The chunking algorithm splits this into segments of ~1500 characters with 200-character overlap. The overlap ensures that context spanning two chunks isn't lost.
3. Each chunk is sent to OpenAI's `text-embedding-3-small` endpoint, which returns a 1536-dimensional float vector
4. The vector is stored in pgvector's `vector(1536)` column alongside the chunk text, document ID, chunk index, and tenant ID
5. An IVFFlat or HNSW index on the vector column accelerates similarity search

At query time, the user's question goes through the same embedding model, and pgvector's `<=>` (cosine distance) operator finds the closest stored vectors.

### Q32: How do webhooks ensure payload authenticity?

**Answer:**
Each webhook configuration includes an automatically generated secret. When a webhook event fires:
1. The payload is serialized to JSON
2. An HMAC-SHA256 signature is computed using the webhook's secret: `HMAC(secret, payload)`
3. The signature is sent in the `X-Webhook-Signature` header
4. The receiving server can verify authenticity by computing the same HMAC with the shared secret and comparing signatures

This prevents tampering — if an attacker modifies the payload in transit, the signature won't match.

---

## 9. Quick Reference Facts

Use these for rapid responses to factual questions:

| Fact | Value |
|------|-------|
| Total unit tests | 201 |
| Test suites | 19 |
| Pass rate | 100% |
| Database models | 14 |
| NestJS modules | 15+ |
| Frontend pages | 14 |
| API endpoints | 20+ groups |
| Policy types | 7 |
| AI providers | 4 (OpenAI, Claude, Gemini, Mock) |
| User roles | 5 (Super Admin, Tenant Admin, Admin, Developer, User) |
| Tenant tiers | 4 (Free, Starter, Professional, Enterprise) |
| Security layers | 9 |
| Encryption | AES-256-CBC (API keys), bcrypt (passwords) |
| JWT access token TTL | 15 minutes |
| JWT refresh token TTL | 7 days |
| Vector dimensions | 1536 |
| Chunk size | ~1500 chars, 200-char overlap |
| Account lockout | 5 attempts → 30-minute lock |
| Backend framework | NestJS 11 |
| Database | PostgreSQL 16 + pgvector |
| ORM | Prisma 5 |
| Cache/Queue | Redis 7 + BullMQ |
| Frontend | React 18 + Tailwind + Zustand |

---

## 10. Presentation Tips

1. **Start with the problem, not the solution** — Examiners want to know why this project matters before they hear what you built
2. **Use the architecture diagram** — Visual explanations are more effective than verbal descriptions
3. **Be honest about limitations** — Acknowledging what you didn't implement shows maturity
4. **Reference specific numbers** — "201 tests, 100% pass rate, 95% coverage" is more compelling than "comprehensive testing"
5. **Prepare for "why not microservices"** — This will almost certainly be asked; the modular monolith justification is well-established
6. **Know your security layers** — Security questions are common; being able to list all 9 layers with specific technologies shows thorough understanding
7. **Connect to the literature** — Reference the EU AI Act, NIST framework, and RAG paper when relevant
8. **Demo preparation** — Have the application running locally before the viva, ready to show live
