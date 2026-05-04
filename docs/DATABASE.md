# Database Guide

## Overview

The platform uses a single PostgreSQL 16 database with the **pgvector** extension for vector similarity search. All models are defined in `backend-api/prisma/schema.prisma` and managed via Prisma ORM.

## Entity Relationship Diagram

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Tenant  │────<│   User   │────<│ Session  │
│          │     │          │     │          │
└────┬─────┘     └────┬─────┘     └──────────┘
     │                │
     │    ┌───────────┼───────────┬──────────────┐
     │    │           │           │              │
     ▼    ▼           ▼           ▼              ▼
┌────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
│   Policy   │ │ AuditLog │ │ Document │ │   AiLog      │
│            │ │          │ │          │ │              │
└─────┬──────┘ └──────────┘ └────┬─────┘ └──────────────┘
      │                          │
      ▼                          ▼
┌──────────┐              ┌──────────────┐
│PolicyLog │              │DocumentChunk │
│          │              │  (pgvector)  │
└──────────┘              └──────────────┘
```

## Models

### Tenant

Central model for multi-tenancy. All resources are scoped to a tenant.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | String | Organization name |
| slug | String | Unique URL-friendly identifier |
| description | String? | Optional description |
| isActive | Boolean | Soft active/inactive toggle |
| settings | Json? | Tenant-specific configuration |
| maxUsers | Int | Maximum users allowed (default: 50) |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |
| deletedAt | DateTime? | Soft delete timestamp |

**Indexes:** `slug` (unique), `isActive`

### User

Platform users with role-based access and tenant assignment.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| email | String | Unique email address |
| password | String | bcrypt hashed password |
| firstName | String | First name |
| lastName | String | Last name |
| role | Role enum | SUPER_ADMIN, TENANT_ADMIN, ADMIN, USER, DEVELOPER |
| tenantId | UUID? | Assigned tenant (null for Super Admin) |
| isActive | Boolean | Account active status |
| isEmailVerified | Boolean | Email verification status |
| loginAttempts | Int | Failed login counter |
| lockedUntil | DateTime? | Account lock expiry |
| lastLoginAt | DateTime? | Last successful login |
| lastLoginIp | String? | Last login IP address |

**Relationships:** belongs to Tenant, has many Sessions, AuditLogs

### Policy

Governance rules for AI request evaluation.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| tenantId | UUID | Owning tenant |
| name | String | Policy name |
| description | String? | Policy description |
| type | PolicyType enum | KEYWORD_BLOCK, MODEL_RESTRICT, TOPIC_RESTRICT, SENSITIVE_DATA, RATE_LIMIT, USAGE_QUOTA, CUSTOM |
| rules | Json | Policy-specific rule configuration |
| action | PolicyAction enum | DENY, ALLOW, FLAG, LOG, RATE_LIMIT |
| priority | Int | Evaluation order (lower = higher priority) |
| isActive | Boolean | Whether policy is enforced |

**Rules JSON Examples:**

```json
// KEYWORD_BLOCK
{ "keywords": ["password", "secret", "credential"] }

// MODEL_RESTRICT
{ "allowedModels": ["gpt-4o-mini", "gpt-4o"] }

// TOPIC_RESTRICT
{ "topics": ["violence", "weapons"] }

// SENSITIVE_DATA
{ "patterns": ["ssn", "credit_card", "email", "phone"] }
```

### PolicyLog

Audit trail for policy evaluations.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| policyId | UUID | Evaluated policy |
| tenantId | UUID | Tenant context |
| userId | String? | User who triggered evaluation |
| decision | String | ALLOWED, DENIED, FLAGGED |
| prompt | String? | The evaluated prompt text |
| matchedRule | Json? | Which rule was triggered |
| metadata | Json? | Additional context |
| createdAt | DateTime | Evaluation timestamp |

### AiLog

Complete audit trail of AI gateway interactions.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| tenantId | UUID | Tenant context |
| userId | String? | Requesting user |
| provider | String | AI provider used (openai, anthropic, etc.) |
| model | String | AI model used |
| prompt | String? | User prompt (first 2000 chars) |
| response | String? | AI response (first 2000 chars) |
| promptTokens | Int? | Tokens in prompt |
| completionTokens | Int? | Tokens in response |
| totalTokens | Int? | Total tokens used |
| latencyMs | Int? | Request latency in milliseconds |
| status | AiRequestStatus | PENDING, SUCCESS, FAILED, DENIED, RATE_LIMITED |
| statusCode | Int? | HTTP status code |
| errorMessage | String? | Error details if failed |
| policyDecision | String? | Policy evaluation result |
| policyName | String? | Name of triggered policy |

**Indexes:** `tenantId`, `userId`, `provider`, `status`, `createdAt`

### ApiKey

Encrypted storage for AI provider API keys.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| tenantId | UUID | Owning tenant |
| name | String | Descriptive name |
| provider | String | AI provider (openai, anthropic, gemini) |
| keyHash | String | AES-256-CBC encrypted key |
| keyPrefix | String | First 8 chars for identification |
| isActive | Boolean | Whether key is usable |
| lastUsedAt | DateTime? | Last usage timestamp |
| createdBy | String | User who created the key |

**Constraints:** Unique on `(tenantId, provider)` — one key per provider per tenant

### Document (RAG)

Uploaded documents for retrieval-augmented generation.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| tenantId | UUID | Owning tenant |
| title | String | Document title |
| description | String? | Optional description |
| fileName | String | Original filename |
| fileType | String | MIME type |
| fileSize | Int | File size in bytes |
| storageKey | String | Path in local storage |
| status | DocumentStatus | PENDING, PROCESSING, COMPLETED, FAILED |
| totalChunks | Int | Number of text chunks generated |
| errorMessage | String? | Error if processing failed |
| uploadedBy | String | User who uploaded |

### DocumentChunk (RAG)

Text chunks with vector embeddings for semantic search.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| documentId | UUID | Parent document |
| chunkIndex | Int | Position in document |
| content | String | Chunk text content |
| tokenCount | Int? | Estimated token count |
| embedding | vector(1536) | pgvector embedding for similarity search |

**Vector Operations:** Uses pgvector's `<=>` operator for cosine distance similarity search.

### AuditLog

General-purpose audit trail for all platform actions.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| action | String | Action type (LOGIN, CREATE, UPDATE, DELETE, etc.) |
| resource | String | Resource type (auth, users, tenants, etc.) |
| resourceId | String? | ID of affected resource |
| userId | String? | Acting user |
| tenantId | String? | Tenant context |
| requestId | String? | Request correlation ID |
| description | String? | Human-readable description |
| metadata | Json? | Additional context |
| ipAddress | String? | Client IP address |
| userAgent | String? | Client user agent |

### Other Models

| Model | Purpose |
|-------|---------|
| **Session** | JWT refresh token sessions with revocation support |
| **Notification** | In-app notifications (tenant-scoped) |
| **Webhook** | Outbound webhook configurations (tenant-scoped) |
| **FileUpload** | General file upload records |
| **FeatureFlag** | Runtime feature toggles |

## Enums

```
Role: USER, ADMIN, TENANT_ADMIN, DEVELOPER, SUPER_ADMIN
PolicyType: KEYWORD_BLOCK, RATE_LIMIT, MODEL_RESTRICT, TOPIC_RESTRICT, SENSITIVE_DATA, USAGE_QUOTA, CUSTOM
PolicyAction: ALLOW, DENY, FLAG, LOG, RATE_LIMIT
DocumentStatus: PENDING, PROCESSING, COMPLETED, FAILED
AiRequestStatus: PENDING, SUCCESS, FAILED, DENIED, RATE_LIMITED
```

## Useful Commands

```bash
# Open database GUI
npx prisma studio

# Reset database
npx prisma db push --force-reset

# Generate migration
npx prisma migrate dev --name <migration-name>

# View current schema
npx prisma format
```
