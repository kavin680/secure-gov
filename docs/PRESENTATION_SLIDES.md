# Presentation Slides

## Secure Multi-Tenant AI Governance Platform

### Final-Year Project Presentation

---

## Slide 1: Title

**Secure Multi-Tenant AI Governance Platform**

A web-based middleware for centralized AI security, policy enforcement, and controlled AI integration.

- **Student:** [Your Name]
- **Supervisor:** [Supervisor Name]
- **Date:** [Presentation Date]
- **Repository:** github.com/kavin680/secure-gov

---

## Slide 2: The Problem

**Enterprise AI adoption is growing faster than governance**

- 65%+ of organizations are experimenting with generative AI (McKinsey, 2024)
- **Data leakage** — Employees sending PII and credentials to external AI providers
- **No audit trail** — Regulated industries need records of every AI interaction
- **Cost overruns** — Uncontrolled API usage creating unexpected bills
- **Model misuse** — Users accessing models not approved for their data sensitivity level
- **Multi-department isolation** — Different business units sharing infrastructure without data boundaries

**Key Question:** How do we let enterprises use AI while maintaining security, compliance, and cost control?

---

## Slide 3: The Solution

**A governance middleware that sits between users and AI providers**

```
Enterprise App  →  Governance Platform  →  AI Provider
                   ✓ Authenticate
                   ✓ Verify tenant
                   ✓ Apply RBAC
                   ✓ Enforce policies
                   ✓ Log everything
                   ✓ Return response
```

**Key capabilities:**
- Multi-tenant data isolation
- Configurable policy engine (7 rule types)
- AI gateway proxying to OpenAI, Claude, Gemini
- Document-grounded RAG responses
- Comprehensive audit trail

---

## Slide 4: Architecture Overview

**Modular Monolith — NestJS with 15+ modules**

```
┌─────────────────────────────────────────────┐
│              NestJS Application              │
│  ┌─────────────────────────────────────┐    │
│  │   Middleware: RequestID → Helmet    │    │
│  │   Guards: JWT → RBAC → Tenant      │    │
│  └─────────────────────────────────────┘    │
│  ┌──────┬────────┬─────────┬───────────┐   │
│  │ Auth │ Policy │ AI Gate │    RAG    │   │
│  │      │ Engine │  -way   │           │   │
│  ├──────┼────────┼─────────┼───────────┤   │
│  │Users │Monitor │ Audit   │Notify/WS  │   │
│  └──────┴────────┴─────────┴───────────┘   │
└──────────────┬──────────────┬───────────────┘
          PostgreSQL        Redis
          + pgvector      Cache/Queue
```

**Why monolith?** Simpler for prototype; NestJS modules provide logical separation equivalent to microservices boundaries.

---

## Slide 5: Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Backend | NestJS 11 + TypeScript | Type-safe, modular, built-in DI |
| Database | PostgreSQL 16 + pgvector | ACID + vector search in one DB |
| ORM | Prisma 5 | Type-safe queries, schema-as-code |
| Cache/Queue | Redis 7 + BullMQ | Sub-ms caching, reliable async jobs |
| Auth | JWT + Passport.js + bcrypt | Stateless API auth with refresh tokens |
| Frontend | React 18 + Tailwind + Zustand | Component-based, responsive, minimal |
| Real-time | Socket.IO | WebSocket notifications |
| Infrastructure | Docker + Docker Compose | Consistent dev/prod environments |

---

## Slide 6: Multi-Tenant Architecture

**Shared-schema with application-level isolation**

- Every entity has a `tenantId` foreign key
- Every query is filtered by `tenantId`
- `TenantGuard` validates JWT tenant against requested resource
- Super Admins bypass tenant filtering

**Isolated per tenant:**
Users, Policies, AI Logs, Documents, Embeddings, API Keys, Audit Logs, Notifications, Webhooks, File Uploads

**Tenant tiers:** FREE (30 req/min) → STARTER (100) → PROFESSIONAL (500) → ENTERPRISE (2000)

---

## Slide 7: Policy Engine

**7 configurable policy types evaluated before every AI request**

| Type | What it does |
|------|-------------|
| KEYWORD_BLOCK | Block prompts containing specified words |
| MODEL_RESTRICT | Only allow approved models |
| TOPIC_RESTRICT | Block restricted topics |
| SENSITIVE_DATA | Detect SSN, credit cards, emails, phones via regex |
| RATE_LIMIT | Limit requests per time window |
| USAGE_QUOTA | Cap token usage per period |
| CUSTOM | JSON-configurable extension point |

**Flow:** Load policies (sorted by priority) → Evaluate each → First DENY stops → Log decision

---

## Slide 8: AI Gateway

**Provider-agnostic proxy with policy enforcement**

```
User Request
    │
    ▼
┌─────────────────┐     ┌──────────────────┐
│ Policy Engine   │────▶│ DENIED? → Log    │→ Return 403
│ Evaluate prompt │     │   + Return error │
└────────┬────────┘     └──────────────────┘
         │ ALLOWED
         ▼
┌─────────────────┐
│ Get API Key     │  AES-256-CBC decryption
│ Forward to      │  OpenAI / Claude / Gemini / Mock
│ Provider        │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Log interaction │  Prompt, response, tokens,
│ Return response │  latency, cost, policy decision
└─────────────────┘
```

**Supported providers:** OpenAI (GPT-4o, GPT-4o-mini), Anthropic (Claude 3), Google (Gemini), Mock (testing)

---

## Slide 9: RAG Module

**Document-grounded AI responses using vector similarity search**

```
Upload PDF/DOCX/TXT → Extract Text → Chunk (~1500 chars)
                                          │
                                          ▼
                                    Generate Embeddings
                                    (1536 dims, OpenAI)
                                          │
                                          ▼
                                    Store in pgvector
```

**At query time:**
1. Embed the user's question
2. Find top-K similar chunks (cosine distance, tenant-scoped)
3. Build system prompt with document context
4. Forward to AI provider (with policy enforcement)
5. Return response + source documents with similarity scores

**Why pgvector?** Same PostgreSQL instance — no extra infrastructure.

---

## Slide 10: Security — Defense in Depth

**9 security layers:**

```
 1. Transport Security    │ Helmet headers, CORS
 2. Rate Limiting         │ Per-tenant tier throttling
 3. Authentication        │ JWT (15min) + Refresh (7d)
 4. Authorization         │ RBAC — 5 roles
 5. Tenant Isolation      │ TenantGuard + query filtering
 6. Input Validation      │ class-validator, whitelist
 7. Policy Enforcement    │ 7 configurable rule types
 8. Encryption at Rest    │ AES-256-CBC (API keys), bcrypt
 9. Audit Logging         │ Every action tracked
```

**Additional:** Account lockout (5 attempts → 30min lock), email verification, password reset tokens, HMAC-signed webhooks.

---

## Slide 11: Frontend

**14 pages — React 18 + Tailwind CSS + shadcn/ui**

| Page Group | Pages |
|-----------|-------|
| Auth | Login, Register |
| Core | Dashboard, Tenants, Users, Policies |
| AI | AI Chat, RAG Documents |
| Operations | Monitoring, API Keys, Audit Logs |
| Supporting | Notifications, Feature Flags, Webhooks, Settings |

**Key features:**
- Role-based sidebar navigation
- Auto JWT refresh via Axios interceptor
- Real-time notifications via WebSocket
- Charts and analytics (Recharts)

---

## Slide 12: Testing Results

**201 unit tests — 100% pass rate**

| Category | Suites | Tests | Coverage |
|----------|--------|-------|----------|
| Core Services | 7 | 106 | 90–100% |
| Guards & Middleware | 3 | 15 | 100% |
| Interceptors & Filters | 4 | 20 | 100% |
| Utilities | 3 | 21 | 100% |
| **Total** | **19** | **201** | **~95%** |

**Also verified:**
- All API endpoints functional (curl + Swagger)
- Frontend: 14 pages load, zero console errors
- Security: Cross-tenant access blocked, brute-force protected
- TypeScript: Clean compilation, no type errors

---

## Slide 13: Production Readiness

**Phase 12 — Ready for deployment**

| Feature | Implementation |
|---------|---------------|
| WebSocket notifications | Socket.IO gateway, JWT auth, room-based routing |
| Email verification | Integrated with registration, resend endpoint |
| Password reset | Token-based with configurable expiration |
| Per-tenant rate limiting | Dynamic based on tier (FREE → ENTERPRISE) |
| S3 file storage | AWS S3 adapter with CDN support |
| Observability | Sentry error tracking + Datadog APM |
| Production Docker | Multi-replica, health checks, resource limits |
| Managed services | Config for AWS RDS, ElastiCache, cloud SMTP |

---

## Slide 14: Demo Architecture

**Live demo walkthrough:**

1. **Login** as Super Admin → see platform dashboard
2. **Create tenant** → configure policies
3. **AI Chat** → demonstrate policy blocking (keyword, sensitive data)
4. **Upload document** → RAG search → context-aware chat
5. **Monitoring** → view usage report and compliance data
6. **Audit logs** → trace complete request lifecycle

---

## Slide 15: Comparison with Existing Solutions

| Feature | This Project | AWS Bedrock | Azure AI Safety |
|---------|-------------|-------------|-----------------|
| Multi-tenant | **Yes** | No | No |
| Self-hosted | **Yes** | No | No |
| Custom policies | **7 types** | Limited | Categories only |
| RAG built-in | **Yes** | Separate | Separate |
| Multi-provider | **3 + Mock** | AWS only | Azure only |
| Open source | **Yes** | No | No |
| RBAC | **5 roles** | IAM | Azure AD |

**Differentiator:** Only self-hosted, multi-tenant, open-source AI governance platform with built-in RAG.

---

## Slide 16: Limitations and Future Work

**Current limitations:**
- No output filtering (responses not scanned)
- No enterprise SSO (SAML/OIDC)
- No production load testing
- Single-region deployment only
- Mock AI testing (real providers may differ)

**Future work:**
1. AI response filtering for policy violations
2. SAML/OIDC enterprise SSO integration
3. Prompt injection detection (classifier-based)
4. Cost management with per-tenant budgets
5. Compliance templates (SOC 2, HIPAA, GDPR)
6. Local embedding models (eliminate API dependency)
7. Multi-region deployment with data replication

---

## Slide 17: Key Achievements

- **Full-stack implementation** — 15+ NestJS modules, 14 React pages
- **201 unit tests** — 100% pass rate, >90% coverage
- **7 policy types** — Comprehensive AI governance rules
- **3 AI providers** — OpenAI, Claude, Gemini with mock for testing
- **RAG pipeline** — Document processing to vector search in one platform
- **9 security layers** — Defense-in-depth from transport to audit
- **Production-ready** — Docker, S3, Sentry, WebSocket, email flows
- **14 database models** — Prisma schema covering all domains

---

## Slide 18: Conclusion

**This project demonstrates that centralized AI governance is:**

- **Technically feasible** — Built with proven, production-grade technologies
- **Operationally practical** — Configurable policies, per-tenant isolation, real-time monitoring
- **Extensible** — Modular architecture enables independent component evolution
- **Secure** — Defense-in-depth with comprehensive audit trails

**The platform provides a foundation for organizations to adopt AI responsibly** while maintaining the security, compliance, and cost controls that enterprise environments require.

---

## Slide 19: Q&A

**Thank you**

**Links:**
- Backend: github.com/kavin680/secure-gov
- Frontend: github.com/kavin680/secure-gov-ui
- API Docs: localhost:3000/docs (Swagger)
- Demo accounts: See README.md for test credentials
