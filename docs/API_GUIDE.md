# API Guide

Complete API reference for the Secure Multi-Tenant AI Governance Platform.

**Base URL:** `http://localhost:3000`
**Swagger UI:** `http://localhost:3000/docs`

All endpoints (except auth) require a Bearer token in the `Authorization` header.

## Authentication

### Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "admin@acme.com",
  "password": "Admin@123456"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "uuid",
      "email": "admin@acme.com",
      "firstName": "Acme",
      "lastName": "Admin",
      "role": "TENANT_ADMIN",
      "tenantId": "uuid"
    }
  }
}
```

### Register

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "newuser@example.com",
  "password": "SecurePass@123",
  "firstName": "John",
  "lastName": "Doe"
}
```

### Refresh Token

```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

## Tenants (Super Admin Only)

### Create Tenant

```http
POST /api/v1/tenants
Authorization: Bearer <super_admin_token>

{
  "name": "New Company",
  "slug": "new-company",
  "description": "A new tenant organization",
  "maxUsers": 25
}
```

### List Tenants

```http
GET /api/v1/tenants
Authorization: Bearer <super_admin_token>
```

### Get Tenant Details

```http
GET /api/v1/tenants/:id
Authorization: Bearer <super_admin_token>
```

### Get Tenant Statistics

```http
GET /api/v1/tenants/:id/stats
Authorization: Bearer <super_admin_token>
```

### List Tenant Users

```http
GET /api/v1/tenants/:id/users
Authorization: Bearer <super_admin_token>
```

### Add User to Tenant

```http
POST /api/v1/tenants/:id/users
Authorization: Bearer <super_admin_token>

{
  "email": "user@company.com",
  "password": "SecurePass@123",
  "firstName": "Jane",
  "lastName": "Smith",
  "role": "USER"
}
```

---

## Policies

### Create Policy

```http
POST /api/v1/policies
Authorization: Bearer <tenant_admin_token>

{
  "name": "Block Dangerous Keywords",
  "description": "Blocks prompts containing sensitive keywords",
  "type": "KEYWORD_BLOCK",
  "rules": {
    "keywords": ["password", "secret", "credential", "api key"]
  },
  "action": "DENY",
  "priority": 1
}
```

**Policy Types:**
- `KEYWORD_BLOCK` — Block prompts containing specific words
- `MODEL_RESTRICT` — Restrict which AI models can be used
- `TOPIC_RESTRICT` — Block prompts about specific topics
- `SENSITIVE_DATA` — Detect SSN, credit cards, emails, phone numbers
- `RATE_LIMIT` — Rate limiting rules
- `USAGE_QUOTA` — Usage quota enforcement
- `CUSTOM` — Custom rule evaluation

**Policy Actions:**
- `DENY` — Block the request
- `ALLOW` — Explicitly allow
- `FLAG` — Allow but flag for review
- `LOG` — Allow but log the match

### Evaluate Prompt Against Policies

Test how a prompt would be evaluated without sending to AI:

```http
POST /api/v1/policies/evaluate
Authorization: Bearer <tenant_user_token>

{
  "prompt": "What is my password?",
  "model": "gpt-4o-mini"
}
```

**Response (DENIED):**
```json
{
  "data": {
    "decision": "DENIED",
    "policyName": "Block Sensitive Keywords",
    "policyType": "KEYWORD_BLOCK",
    "reason": "Prompt contains blocked keyword: \"password\""
  }
}
```

**Response (ALLOWED):**
```json
{
  "data": {
    "decision": "ALLOWED",
    "policyName": null,
    "reason": "All policies passed"
  }
}
```

### List Policies

```http
GET /api/v1/policies
Authorization: Bearer <tenant_admin_token>
```

### Toggle Policy

```http
POST /api/v1/policies/:id/toggle
Authorization: Bearer <tenant_admin_token>
```

### Get Policy Logs

```http
GET /api/v1/policies/:id/logs
Authorization: Bearer <tenant_admin_token>
```

---

## AI Gateway

### Send Chat Request

The main endpoint. Evaluates policies, forwards to AI provider, logs everything.

```http
POST /api/v1/ai/chat
Authorization: Bearer <tenant_user_token>

{
  "model": "gpt-4o-mini",
  "messages": [
    { "role": "user", "content": "What is cloud computing?" }
  ],
  "provider": "mock",
  "temperature": 0.7,
  "maxTokens": 1024
}
```

**Response:**
```json
{
  "data": {
    "content": "Cloud computing is the delivery of computing services...",
    "model": "gpt-4o-mini",
    "provider": "mock",
    "usage": {
      "promptTokens": 12,
      "completionTokens": 16,
      "totalTokens": 28
    },
    "latencyMs": 105,
    "logId": "uuid",
    "policyCheck": {
      "allowed": true,
      "decision": "ALLOWED"
    }
  }
}
```

**Providers and Models:**

| Provider | Models |
|----------|--------|
| `openai` | gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-4, gpt-3.5-turbo |
| `anthropic` | claude-3-opus, claude-3-sonnet, claude-3-haiku, claude-3.5-sonnet |
| `gemini` | gemini-1.5-pro, gemini-1.5-flash, gemini-1.0-pro |
| `mock` | Any model name (no API key required, returns mock responses) |

### List Providers

```http
GET /api/v1/ai/providers
Authorization: Bearer <tenant_user_token>
```

### Add API Key

```http
POST /api/v1/ai/api-keys
Authorization: Bearer <tenant_admin_token>

{
  "provider": "openai",
  "name": "Production OpenAI Key",
  "key": "sk-..."
}
```

### List API Keys (Masked)

```http
GET /api/v1/ai/api-keys
Authorization: Bearer <tenant_admin_token>
```

### Toggle API Key

```http
POST /api/v1/ai/api-keys/:id/toggle
Authorization: Bearer <tenant_admin_token>
```

### Rotate API Key

```http
POST /api/v1/ai/api-keys/:id/rotate
Authorization: Bearer <tenant_admin_token>

{
  "newKey": "sk-new-key-..."
}
```

### View AI Logs

```http
GET /api/v1/ai/logs?page=1&limit=20&status=SUCCESS&provider=mock
Authorization: Bearer <tenant_admin_token>
```

### Get Usage Statistics

```http
GET /api/v1/ai/usage
Authorization: Bearer <tenant_admin_token>
```

---

## RAG (Document Intelligence)

### Upload Document

```http
POST /api/v1/rag/documents
Authorization: Bearer <tenant_admin_token>
Content-Type: multipart/form-data

file: <binary file (PDF, DOCX, or TXT)>
title: "Company Policy Manual"
description: "Internal policies and procedures"
```

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "title": "Company Policy Manual",
    "fileName": "policy-manual.pdf",
    "fileType": "application/pdf",
    "fileSize": 245760,
    "status": "PENDING",
    "totalChunks": 0,
    "uploadedBy": "user-uuid",
    "createdAt": "2026-05-04T10:00:00.000Z"
  }
}
```

The document is processed asynchronously:
- `PENDING` → `PROCESSING` → `COMPLETED` (or `FAILED`)
- Text extraction, chunking, and embedding happen in the background

### List Documents

```http
GET /api/v1/rag/documents
Authorization: Bearer <tenant_user_token>
```

### Get Document Details (with chunks)

```http
GET /api/v1/rag/documents/:id
Authorization: Bearer <tenant_user_token>
```

### Delete Document

```http
DELETE /api/v1/rag/documents/:id
Authorization: Bearer <tenant_admin_token>
```

### Reprocess Document

Re-extracts text, re-chunks, and re-generates embeddings:

```http
POST /api/v1/rag/documents/:id/reprocess
Authorization: Bearer <tenant_admin_token>
```

### Semantic Search

Search across all tenant documents using vector similarity:

```http
POST /api/v1/rag/search
Authorization: Bearer <tenant_user_token>

{
  "query": "What is the refund policy?",
  "topK": 5,
  "documentId": "optional-uuid-to-filter"
}
```

**Response:**
```json
{
  "data": [
    {
      "id": "chunk-uuid",
      "content": "Our refund policy states that customers may...",
      "chunkIndex": 3,
      "documentId": "doc-uuid",
      "documentTitle": "Company Policy Manual",
      "similarity": 0.89
    }
  ]
}
```

### RAG Chat (Document-Aware AI)

Retrieves relevant document chunks and includes them as context for the AI:

```http
POST /api/v1/rag/chat
Authorization: Bearer <tenant_user_token>

{
  "message": "What is the company's refund policy?",
  "model": "gpt-4o-mini",
  "provider": "mock",
  "topK": 5
}
```

**Response:**
```json
{
  "data": {
    "answer": "Based on the company policy manual, the refund policy...",
    "model": "gpt-4o-mini",
    "provider": "mock",
    "usage": { "promptTokens": 150, "completionTokens": 80, "totalTokens": 230 },
    "latencyMs": 420,
    "logId": "uuid",
    "sources": [
      {
        "documentId": "doc-uuid",
        "documentTitle": "Company Policy Manual",
        "chunkIndex": 3,
        "similarity": 0.89,
        "excerpt": "Our refund policy states that customers may..."
      }
    ]
  }
}
```

### Get Document Statistics

```http
GET /api/v1/rag/documents/stats
Authorization: Bearer <tenant_admin_token>
```

---

## Monitoring & Analytics

### Dashboard Overview

Returns high-level statistics. Tenant Admins see their tenant data; Super Admins see platform-wide data.

```http
GET /api/v1/monitoring/dashboard
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "data": {
    "overview": {
      "totalUsers": 7,
      "activeUsers": 7,
      "totalTenants": 2,
      "totalPolicies": 6,
      "totalAiRequests": 15,
      "aiRequestsLast24h": 8,
      "totalDocuments": 3
    },
    "recentActivity": [
      {
        "id": "uuid",
        "action": "LOGIN",
        "resource": "auth",
        "userId": "uuid",
        "createdAt": "2026-05-04T10:00:00.000Z"
      }
    ]
  }
}
```

### Usage Report

```http
GET /api/v1/monitoring/usage?days=30
Authorization: Bearer <admin_token>
```

Returns: requests by day, by provider, by status, token usage totals, top users.

### Compliance Report

```http
GET /api/v1/monitoring/compliance
Authorization: Bearer <admin_token>
```

Returns: policy violations count, denied AI requests, active/total policies, breakdown by decision type.

### Security Report

```http
GET /api/v1/monitoring/security
Authorization: Bearer <admin_token>
```

Returns: failed login counts (24h and 7d), locked accounts, recent security events.

### Per-Tenant Report (Super Admin Only)

```http
GET /api/v1/monitoring/tenants/:tenantId/report
Authorization: Bearer <super_admin_token>
```

Returns: tenant details, user count, policy count, document count, AI request stats.

---

## Standard Response Format

### Success

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Success",
  "data": { ... },
  "requestId": "uuid",
  "timestamp": "2026-05-04T10:00:00.000Z"
}
```

### Error

```json
{
  "success": false,
  "statusCode": 403,
  "message": "Request blocked by policy",
  "error": "Forbidden",
  "requestId": "uuid",
  "timestamp": "2026-05-04T10:00:00.000Z"
}
```

### Common Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Validation error |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (insufficient permissions or policy block) |
| 404 | Not found |
| 409 | Conflict (duplicate resource) |
| 429 | Rate limited |
| 500 | Internal server error |
