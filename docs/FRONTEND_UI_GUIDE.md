# Phase 11: Frontend UI — Complete Integration Guide

A full guide to building the frontend for the Secure Multi-Tenant AI Governance Platform. This document covers recommended tech stack, project structure, every page/component, API integration patterns, authentication flow, role-based rendering, and how to connect each feature to the backend.

---

## Table of Contents

1. [Recommended Tech Stack](#recommended-tech-stack)
2. [Project Setup](#project-setup)
3. [Backend Connection](#backend-connection)
4. [Authentication Flow](#authentication-flow)
5. [Role-Based Access Control (RBAC)](#role-based-access-control-rbac)
6. [Standard API Response Format](#standard-api-response-format)
7. [Page-by-Page Breakdown](#page-by-page-breakdown)
   - [Login Page](#1-login-page)
   - [Register Page](#2-register-page)
   - [Dashboard](#3-dashboard)
   - [Tenant Management](#4-tenant-management-super-admin)
   - [User Management](#5-user-management)
   - [Policy Management](#6-policy-management)
   - [AI Chat Interface](#7-ai-chat-interface)
   - [RAG Document Intelligence](#8-rag-document-intelligence)
   - [Monitoring & Analytics](#9-monitoring--analytics)
   - [API Key Management](#10-api-key-management)
   - [Audit Logs](#11-audit-logs)
   - [Notifications](#12-notifications)
   - [Feature Flags](#13-feature-flags-super-admin)
   - [Webhooks](#14-webhooks)
   - [Settings](#15-settings)
8. [Shared Components](#shared-components)
9. [Error Handling](#error-handling)
10. [Environment Variables](#environment-variables)

---

## Recommended Tech Stack

| Layer | Recommendation | Why |
|-------|---------------|-----|
| Framework | **Next.js 14+ (App Router)** or **React 18+ with Vite** | SSR optional; App Router has built-in layouts for role-based shells |
| Language | **TypeScript** | Matches backend; share types if desired |
| Styling | **Tailwind CSS + shadcn/ui** or **Chakra UI** | Rapid UI development with accessible components |
| State | **Zustand** or **React Context** | Lightweight; JWT + user state only |
| HTTP Client | **Axios** or **fetch** with wrapper | Interceptors for auth token refresh |
| Forms | **React Hook Form + Zod** | Matches backend's class-validator patterns |
| Charts | **Recharts** or **Chart.js** | For monitoring dashboards |
| Tables | **TanStack Table** | Sortable, filterable data tables |
| Notifications | **Sonner** or **react-hot-toast** | Toast notifications |
| Icons | **Lucide React** | Consistent icon set |
| File Upload | **react-dropzone** | Drag & drop for RAG document upload |
| Markdown | **react-markdown** | Render AI chat responses |

---

## Project Setup

```bash
# Option A: Next.js
npx create-next-app@latest secure-gov-ui --typescript --tailwind --app --src-dir
cd secure-gov-ui
npm install axios zustand react-hook-form @hookform/resolvers zod recharts
npm install @tanstack/react-table react-dropzone sonner lucide-react

# Option B: Vite + React
npm create vite@latest secure-gov-ui -- --template react-ts
cd secure-gov-ui
npm install tailwindcss @tailwindcss/vite axios zustand react-hook-form @hookform/resolvers zod
npm install recharts @tanstack/react-table react-dropzone sonner lucide-react react-router-dom
```

### Recommended Folder Structure

```
secure-gov-ui/
├── src/
│   ├── api/                    # API client, interceptors, endpoint functions
│   │   ├── client.ts           # Axios instance with auth interceptor
│   │   ├── auth.api.ts         # Auth endpoints
│   │   ├── tenants.api.ts      # Tenant endpoints
│   │   ├── users.api.ts        # User endpoints
│   │   ├── policies.api.ts     # Policy endpoints
│   │   ├── ai-gateway.api.ts   # AI chat endpoints
│   │   ├── rag.api.ts          # RAG endpoints
│   │   ├── monitoring.api.ts   # Monitoring endpoints
│   │   ├── audit.api.ts        # Audit endpoints
│   │   ├── notifications.api.ts
│   │   ├── webhooks.api.ts
│   │   ├── feature-flags.api.ts
│   │   └── api-keys.api.ts
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx     # Main layout (sidebar + header + content)
│   │   │   ├── Sidebar.tsx      # Navigation sidebar (role-aware)
│   │   │   ├── Header.tsx       # Top bar (user menu, notifications)
│   │   │   └── ProtectedRoute.tsx
│   │   ├── ui/                  # Reusable UI primitives (Button, Card, Modal, etc.)
│   │   ├── charts/              # Chart components for monitoring
│   │   ├── tables/              # Data table wrappers
│   │   └── forms/               # Shared form components
│   ├── pages/ (or app/ for Next.js)
│   │   ├── login/
│   │   ├── register/
│   │   ├── dashboard/
│   │   ├── tenants/
│   │   ├── users/
│   │   ├── policies/
│   │   ├── ai-chat/
│   │   ├── rag/
│   │   ├── monitoring/
│   │   ├── api-keys/
│   │   ├── audit/
│   │   ├── notifications/
│   │   ├── feature-flags/
│   │   ├── webhooks/
│   │   └── settings/
│   ├── stores/
│   │   ├── auth.store.ts       # User, tokens, login/logout
│   │   └── notification.store.ts
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useApi.ts
│   │   └── useRole.ts
│   ├── types/                   # TypeScript interfaces matching backend DTOs
│   │   ├── auth.types.ts
│   │   ├── user.types.ts
│   │   ├── tenant.types.ts
│   │   ├── policy.types.ts
│   │   ├── ai.types.ts
│   │   ├── rag.types.ts
│   │   ├── monitoring.types.ts
│   │   └── common.types.ts
│   ├── lib/
│   │   ├── constants.ts
│   │   └── utils.ts
│   └── styles/
└── .env.local
```

---

## Backend Connection

### API Client Setup (`src/api/client.ts`)

The backend runs on `http://localhost:3000` with global prefix `api` and URI versioning (default `v1`). All endpoints follow the pattern: `http://localhost:3000/api/v1/<module>/<action>`.

```typescript
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Request interceptor — attach JWT
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — handle 401, auto-refresh
apiClient.interceptors.response.use(
  (response) => response.data, // unwrap: returns { success, data, ... }
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const { data } = await axios.post(`${API_BASE_URL}/api/v1/auth/refresh`, {
          refreshToken,
        });

        localStorage.setItem('accessToken', data.data.accessToken);
        localStorage.setItem('refreshToken', data.data.refreshToken);

        originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return apiClient(originalRequest);
      } catch {
        // Refresh failed — force logout
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
```

### CORS Configuration

The backend is preconfigured to accept requests from `http://localhost:3001`. Set `CORS_ORIGINS` in the backend `.env` if your frontend runs on a different port:

```env
CORS_ORIGINS=http://localhost:3001,http://localhost:3000
```

The backend allows these headers: `Content-Type`, `Authorization`, `X-Request-ID`, `X-Correlation-ID`.

---

## Authentication Flow

### How It Works

1. **Login** → `POST /api/v1/auth/login` → returns `accessToken`, `refreshToken`, and `user` object
2. **Store tokens** in `localStorage` (or `httpOnly` cookies if you add cookie support)
3. **Attach token** to every request via Axios interceptor: `Authorization: Bearer <accessToken>`
4. **Token expires** (15 min) → interceptor catches 401 → calls `POST /api/v1/auth/refresh` with `refreshToken`
5. **Refresh returns new token pair** → retry original request
6. **Logout** → `POST /api/v1/auth/logout` with `refreshToken` → clears tokens locally

### Auth Store (`src/stores/auth.store.ts`)

```typescript
import { create } from 'zustand';
import apiClient from '../api/client';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'DEVELOPER' | 'USER' | 'ADMIN';
  tenantId: string | null;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => void;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    const response = await apiClient.post('/auth/login', { email, password });
    const { accessToken, refreshToken, user } = response.data;

    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);

    set({ user, isAuthenticated: true, isLoading: false });
  },

  register: async (data) => {
    await apiClient.post('/auth/register', data);
    // After register, redirect to login
  },

  logout: async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      await apiClient.post('/auth/logout', { refreshToken });
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  loadUser: () => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      try {
        // Decode JWT payload (base64)
        const payload = JSON.parse(atob(token.split('.')[1]));
        set({
          user: {
            id: payload.sub,
            email: payload.email,
            firstName: payload.firstName,
            lastName: payload.lastName,
            role: payload.role,
            tenantId: payload.tenantId,
          },
          isAuthenticated: true,
          isLoading: false,
        });
      } catch {
        set({ isLoading: false });
      }
    } else {
      set({ isLoading: false });
    }
  },
}));
```

### Protected Route Component

```typescript
interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuthStore();

  if (isLoading) return <LoadingSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" />; // or a 403 page
  }

  return <>{children}</>;
}
```

---

## Role-Based Access Control (RBAC)

The backend enforces RBAC, but the frontend should also conditionally render UI elements based on roles.

### Roles Hierarchy

| Role | Scope | Can Access |
|------|-------|------------|
| `SUPER_ADMIN` | Platform-wide | Everything. Tenant management, all tenants' data, feature flags |
| `TENANT_ADMIN` | Own tenant | Policies, users within tenant, API keys, monitoring (own tenant), webhooks |
| `DEVELOPER` | Own tenant | AI chat, RAG upload/search, view policies, view logs |
| `USER` | Own tenant | AI chat, RAG search, view documents |
| `ADMIN` | Legacy | Treat as `TENANT_ADMIN` |

### Sidebar Navigation by Role

```typescript
const navigationItems = [
  // Everyone
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: 'all' },
  { label: 'AI Chat', path: '/ai-chat', icon: MessageSquare, roles: 'all' },

  // Developer+
  { label: 'Documents (RAG)', path: '/rag', icon: FileText,
    roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'DEVELOPER', 'USER'] },

  // Tenant Admin+
  { label: 'Policies', path: '/policies', icon: Shield,
    roles: ['SUPER_ADMIN', 'TENANT_ADMIN'] },
  { label: 'Users', path: '/users', icon: Users,
    roles: ['SUPER_ADMIN', 'TENANT_ADMIN'] },
  { label: 'API Keys', path: '/api-keys', icon: Key,
    roles: ['SUPER_ADMIN', 'TENANT_ADMIN'] },
  { label: 'Monitoring', path: '/monitoring', icon: BarChart3,
    roles: ['SUPER_ADMIN', 'TENANT_ADMIN'] },
  { label: 'Audit Logs', path: '/audit', icon: ScrollText,
    roles: ['SUPER_ADMIN', 'TENANT_ADMIN'] },
  { label: 'Webhooks', path: '/webhooks', icon: Webhook,
    roles: ['SUPER_ADMIN', 'TENANT_ADMIN'] },
  { label: 'Notifications', path: '/notifications', icon: Bell, roles: 'all' },

  // Super Admin only
  { label: 'Tenants', path: '/tenants', icon: Building2,
    roles: ['SUPER_ADMIN'] },
  { label: 'Feature Flags', path: '/feature-flags', icon: ToggleLeft,
    roles: ['SUPER_ADMIN'] },
];
```

---

## Standard API Response Format

Every backend response follows this structure. Your API client should handle it consistently.

### Success Response

```typescript
interface ApiResponse<T> {
  success: true;
  statusCode: number;
  message: string;
  data: T;
  requestId: string;
  timestamp: string;
}
```

### Error Response

```typescript
interface ApiError {
  success: false;
  statusCode: number;
  message: string;
  error: string;
  requestId: string;
  timestamp: string;
}
```

### Common HTTP Status Codes

| Code | Meaning | Frontend Action |
|------|---------|-----------------|
| 200 | Success | Display data |
| 201 | Created | Show success toast, redirect/refresh |
| 400 | Validation error | Show field-level errors from `message` |
| 401 | Unauthorized | Auto-refresh token or redirect to login |
| 403 | Forbidden | Show "Access Denied" or policy block message |
| 404 | Not found | Show "Not Found" page |
| 409 | Conflict | Show "Already exists" message |
| 429 | Rate limited | Show "Too many requests, try again later" |

---

## Page-by-Page Breakdown

### 1. Login Page

**Route:** `/login`
**Access:** Public

**API Endpoint:**
```
POST /api/v1/auth/login
Body: { email: string, password: string }
```

**UI Components:**
- Email input field
- Password input field with show/hide toggle
- "Login" button
- Link to Register page
- Error display for invalid credentials or locked account

**Key Behaviors:**
- On success: store tokens, redirect to `/dashboard`
- On 401: show "Invalid email or password"
- On 403 with "locked": show "Account locked. Try again in 30 minutes"
- On 429: show "Too many attempts"

**Test Accounts (for development):**

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@enterprise.com | Admin@123456 |
| Tenant Admin | admin@acme.com | Admin@123456 |
| User | user@acme.com | Admin@123456 |
| Developer | dev@acme.com | Admin@123456 |

---

### 2. Register Page

**Route:** `/register`
**Access:** Public

**API Endpoint:**
```
POST /api/v1/auth/register
Body: { email, password, firstName, lastName }
```

**UI Components:**
- First name, last name, email, password, confirm password fields
- Password strength indicator
- "Register" button
- Link to Login page

**Key Behaviors:**
- On success: show "Registration successful" and redirect to login
- On 409: show "Email already registered"
- Password validation: show requirements (min length, special chars)

---

### 3. Dashboard

**Route:** `/dashboard`
**Access:** All authenticated users

**API Endpoint:**
```
GET /api/v1/monitoring/dashboard
```

**UI Components:**

**Stat Cards Row (top):**
- Total Users (icon: Users)
- Total Tenants (icon: Building2) — Super Admin only
- Active Policies (icon: Shield)
- AI Requests (icon: MessageSquare)
- AI Requests (24h) (icon: TrendingUp)
- Total Documents (icon: FileText)

**Charts Section:**
- AI requests over time (line chart — from usage endpoint)
- Requests by provider (pie/donut chart)
- Policy decisions breakdown (bar chart — allowed vs denied)

**Recent Activity Table:**
- Latest audit log entries
- Columns: Action, Resource, User, Timestamp
- Link to full audit log

**Role-Specific Views:**
- **Super Admin**: sees platform-wide numbers, all tenants
- **Tenant Admin**: sees own tenant's numbers only
- **User/Developer**: sees simplified dashboard (own usage stats)

---

### 4. Tenant Management (Super Admin)

**Route:** `/tenants`
**Access:** `SUPER_ADMIN` only

**API Endpoints:**
```
GET    /api/v1/tenants              — List all tenants
POST   /api/v1/tenants              — Create tenant
GET    /api/v1/tenants/:id          — Get tenant details
PATCH  /api/v1/tenants/:id          — Update tenant
DELETE /api/v1/tenants/:id          — Soft delete tenant
GET    /api/v1/tenants/:id/stats    — Get tenant statistics
GET    /api/v1/tenants/:id/users    — List tenant users
POST   /api/v1/tenants/:id/users    — Add user to tenant
```

**UI Components:**

**Tenant List Page:**
- Data table with columns: Name, Slug, Users Count, Status, Created At, Actions
- "Create Tenant" button → opens modal/drawer
- Search/filter bar
- Click row → navigate to tenant detail

**Create/Edit Tenant Modal:**
- Fields: Name, Slug (auto-generated from name), Description, Max Users
- Slug field: auto-generate from name, but allow manual edit

**Tenant Detail Page (`/tenants/:id`):**
- Tenant info card (name, slug, description, created date)
- Stats cards: users, policies, AI requests, documents
- Users tab: table of tenant users with role badges
- "Add User" button → modal with email, password, firstName, lastName, role dropdown
- "Delete Tenant" button with confirmation dialog (soft delete)

---

### 5. User Management

**Route:** `/users`
**Access:** `SUPER_ADMIN`, `TENANT_ADMIN`

**API Endpoints:**
```
GET    /api/v1/users                — List users (scoped by role)
POST   /api/v1/users                — Create user
GET    /api/v1/users/:id            — Get user details
PATCH  /api/v1/users/:id            — Update user
DELETE /api/v1/users/:id            — Soft delete user
```

**UI Components:**

**User List Page:**
- Data table: Name, Email, Role (badge), Tenant, Status, Last Login, Actions
- Role filter dropdown
- Search by name/email
- "Create User" button

**Create/Edit User Modal:**
- Fields: firstName, lastName, email, password (create only), role (dropdown)
- Tenant Admin can only assign USER or DEVELOPER roles within their tenant
- Super Admin can assign any role and any tenant

**User Detail Page:**
- Profile card
- Activity history (recent audit logs for this user)
- "Lock/Unlock Account" toggle
- "Delete User" with confirmation

---

### 6. Policy Management

**Route:** `/policies`
**Access:** `SUPER_ADMIN`, `TENANT_ADMIN`

**API Endpoints:**
```
GET    /api/v1/policies              — List policies
POST   /api/v1/policies              — Create policy
PATCH  /api/v1/policies/:id          — Update policy
DELETE /api/v1/policies/:id          — Delete policy
POST   /api/v1/policies/:id/toggle   — Enable/disable
POST   /api/v1/policies/evaluate     — Test a prompt
GET    /api/v1/policies/:id/logs     — View policy logs
GET    /api/v1/policies/stats        — Policy statistics
```

**UI Components:**

**Policy List Page:**
- Data table: Name, Type (badge), Action (badge), Priority, Active (toggle), Created, Actions
- Filter by type, action, active status
- "Create Policy" button

**Create/Edit Policy Form (full page or large modal):**
- Name, Description fields
- **Type selector** (dropdown or card selector):
  - `KEYWORD_BLOCK` → show keyword input (tag-style, comma separated)
  - `MODEL_RESTRICT` → show model checkboxes (gpt-4o, claude-3-sonnet, etc.)
  - `TOPIC_RESTRICT` → show topic keyword input
  - `SENSITIVE_DATA` → show checkboxes: SSN, Credit Card, Email, Phone Number
  - `RATE_LIMIT` → show: max requests (number), time window (seconds)
  - `USAGE_QUOTA` → show: max tokens, max requests, period
  - `CUSTOM` → show JSON editor for custom rules
- **Action selector**: DENY, ALLOW, FLAG, LOG
- **Priority**: number input (lower = higher priority)
- Active toggle

**Policy Rules Editor — Dynamic Form by Type:**

```typescript
// KEYWORD_BLOCK
{ keywords: ['password', 'secret', 'credential'] }

// MODEL_RESTRICT
{ allowedModels: ['gpt-4o-mini', 'gpt-3.5-turbo'] }

// TOPIC_RESTRICT
{ topics: ['violence', 'illegal activities'] }

// SENSITIVE_DATA
{ patterns: ['ssn', 'credit_card', 'email', 'phone'] }

// RATE_LIMIT
{ maxRequests: 100, windowSeconds: 3600 }

// USAGE_QUOTA
{ maxTokens: 1000000, maxRequests: 500, period: 'monthly' }

// CUSTOM
{ maxPromptLength: 5000 }
```

**Policy Test Panel:**
- Text area: "Enter a prompt to test"
- Model dropdown
- "Evaluate" button
- Result display: ALLOWED (green) or DENIED (red) with policy name and reason

**Policy Logs Page (`/policies/:id/logs`):**
- Table: Decision, Prompt (truncated), Model, User, Timestamp
- Filter by decision (ALLOWED/DENIED)

---

### 7. AI Chat Interface

**Route:** `/ai-chat`
**Access:** All authenticated users

**API Endpoint:**
```
POST /api/v1/ai/chat
Body: { model, messages, provider?, temperature?, maxTokens? }
```

**UI Components:**

**Chat Layout (similar to ChatGPT):**
- Left sidebar: conversation list (local state or extend backend)
- Main area: message thread
- Bottom: input bar with controls

**Message Input Bar:**
- Text area (auto-expand)
- Model selector dropdown (grouped by provider):
  - OpenAI: gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo
  - Anthropic: claude-3-opus, claude-3-sonnet, claude-3-haiku, claude-3.5-sonnet
  - Gemini: gemini-1.5-pro, gemini-1.5-flash, gemini-1.0-pro
  - Mock: mock (for testing)
- Provider override dropdown (optional — auto-detected from model)
- Settings gear → temperature slider, max tokens
- Send button

**Message Display:**
- User messages (right-aligned, colored)
- AI responses (left-aligned) with:
  - Rendered markdown content
  - Token usage badge: `12 + 45 = 57 tokens`
  - Latency: `105ms`
  - Provider badge: `mock` / `openai`
  - Policy status indicator: ✓ Allowed (green) or ✗ Blocked (red)
- If policy blocks: show denial message with policy name and reason

**Key Behaviors:**
- Maintain conversation history in state (messages array)
- Each new message appends to `messages` array sent to backend
- Handle streaming if you add SSE support later
- Show loading spinner while waiting for AI response
- If 403 (policy block): display the denial reason inline in chat

---

### 8. RAG Document Intelligence

**Route:** `/rag`
**Access:** All authenticated users (upload restricted to TENANT_ADMIN, DEVELOPER)

**API Endpoints:**
```
POST   /api/v1/rag/documents              — Upload document
GET    /api/v1/rag/documents              — List documents
GET    /api/v1/rag/documents/stats        — Document statistics
GET    /api/v1/rag/documents/:id          — Get document details + chunks
DELETE /api/v1/rag/documents/:id          — Delete document
POST   /api/v1/rag/documents/:id/reprocess — Reprocess document
POST   /api/v1/rag/search                 — Semantic search
POST   /api/v1/rag/chat                   — RAG-aware chat
```

**UI Components:**

**Documents Tab:**
- Document list/grid with: Title, File Type icon, Size, Status badge, Chunks count, Uploaded date
- Status badges:
  - `PENDING` → yellow/orange
  - `PROCESSING` → blue with spinner
  - `COMPLETED` → green
  - `FAILED` → red
- "Upload Document" button → opens upload modal
- Poll for status changes (every 5s) while documents are PENDING/PROCESSING

**Upload Document Modal:**
- Drag-and-drop zone (react-dropzone)
- Accepted types: `.pdf`, `.docx`, `.txt`
- Title field (required)
- Description field (optional)
- Upload progress indicator
- Note: request is `multipart/form-data`, not JSON

```typescript
// Upload example
const formData = new FormData();
formData.append('file', file);
formData.append('title', title);
formData.append('description', description);

await apiClient.post('/rag/documents', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
});
```

**Document Detail Page (`/rag/documents/:id`):**
- Document metadata card
- Chunks list: index, content preview (first 200 chars), embedding status
- "Reprocess" button (re-chunk + re-embed)
- "Delete" button with confirmation

**Search Tab:**
- Search input with "Search documents" placeholder
- Optional: document filter dropdown (search within specific document)
- Top-K slider (default 5, max 20)
- Results list: chunk content, document title, similarity score (percentage), chunk index
- Click result → navigate to document detail

**RAG Chat Tab:**
- Similar to AI Chat but uses `/api/v1/rag/chat` endpoint
- Input: message, model selector, top-K setting
- Response includes:
  - AI answer (rendered markdown)
  - Source documents panel (collapsible):
    - Document title
    - Chunk excerpt
    - Similarity score
    - Click to view full document

---

### 9. Monitoring & Analytics

**Route:** `/monitoring`
**Access:** `SUPER_ADMIN`, `TENANT_ADMIN`

**API Endpoints:**
```
GET /api/v1/monitoring/dashboard              — Overview stats
GET /api/v1/monitoring/usage?days=30          — Usage report
GET /api/v1/monitoring/compliance             — Compliance report
GET /api/v1/monitoring/security               — Security report
GET /api/v1/monitoring/tenants/:id/report     — Per-tenant report (Super Admin)
```

**UI Components:**

**Dashboard Tab (Overview):**
- Stat cards: Users, Tenants, Policies, AI Requests, Requests 24h, Documents
- Recent activity feed

**Usage Tab:**
- Date range selector (7d, 30d, 90d)
- **Requests Over Time** — line chart (x: date, y: request count)
- **Requests by Provider** — pie/donut chart (openai, anthropic, gemini, mock)
- **Requests by Status** — bar chart (SUCCESS, DENIED, ERROR)
- **Token Usage** — stat cards (total prompt tokens, completion tokens, total)
- **Top Users** — table (name, email, request count, token usage)

**Compliance Tab:**
- **Policy Violations** — stat card with count
- **Denied Requests** — stat card with count
- **Active Policies** — stat card (active / total)
- **Violations by Policy Type** — bar chart
- **Recent Violations** — table (policy, prompt excerpt, user, timestamp)

**Security Tab:**
- **Failed Logins (24h)** — stat card
- **Failed Logins (7d)** — stat card
- **Locked Accounts** — stat card with list
- **Recent Security Events** — table (event type, user, IP, timestamp)

**Tenant Reports (Super Admin only):**
- Dropdown to select tenant
- Tenant-specific stats: users, policies, documents, AI requests
- Mini charts for tenant-level usage

---

### 10. API Key Management

**Route:** `/api-keys`
**Access:** `SUPER_ADMIN`, `TENANT_ADMIN`

**API Endpoints:**
```
POST   /api/v1/ai/api-keys              — Add API key
GET    /api/v1/ai/api-keys              — List API keys (masked)
POST   /api/v1/ai/api-keys/:id/toggle   — Enable/disable
POST   /api/v1/ai/api-keys/:id/rotate   — Rotate key
DELETE /api/v1/ai/api-keys/:id          — Delete key
```

**UI Components:**

**API Keys List:**
- Table: Provider (icon + name), Key Name, Key (masked: `sk-...xxxx`), Active (toggle), Created, Actions
- "Add API Key" button

**Add API Key Modal:**
- Provider dropdown: OpenAI, Anthropic, Gemini
- Name field (e.g., "Production OpenAI Key")
- API Key field (password input with show/hide)
- Note: only one key per provider per tenant

**Rotate Key Modal:**
- Shows current key (masked)
- New key input field
- Confirm button

---

### 11. Audit Logs

**Route:** `/audit`
**Access:** `SUPER_ADMIN`, `TENANT_ADMIN`

**API Endpoints:**
```
GET /api/v1/audit?page=1&limit=20&action=LOGIN&resource=auth
```

**UI Components:**

**Audit Log Table:**
- Columns: Action, Resource, User, Details (expandable), IP Address, Timestamp
- Filters: Action type dropdown, Resource type dropdown, Date range
- Search by user
- Pagination (server-side)
- Click row → expand to show full details JSON

**Action Badges:**
- `LOGIN` → blue
- `CREATE` → green
- `UPDATE` → yellow
- `DELETE` → red
- `AI_REQUEST` → purple

---

### 12. Notifications

**Route:** `/notifications`
**Access:** All authenticated users

**API Endpoints:**
```
GET    /api/v1/notifications           — List notifications
PATCH  /api/v1/notifications/:id/read  — Mark as read
POST   /api/v1/notifications           — Create notification (admin)
```

**UI Components:**

**Notification Bell (Header):**
- Bell icon with unread count badge
- Dropdown showing latest 5 notifications
- "View all" link

**Notifications Page:**
- List of notifications with: title, message, read/unread indicator, timestamp
- "Mark all as read" button
- Click to mark individual as read
- Filter: All / Unread

---

### 13. Feature Flags (Super Admin)

**Route:** `/feature-flags`
**Access:** `SUPER_ADMIN` only

**API Endpoints:**
```
GET    /api/v1/feature-flags           — List flags
POST   /api/v1/feature-flags           — Create flag
PATCH  /api/v1/feature-flags/:id       — Update flag
DELETE /api/v1/feature-flags/:id       — Delete flag
```

**UI Components:**
- Table: Flag Key, Description, Enabled (toggle), Created, Actions
- "Create Flag" modal: key (slug format), description, enabled toggle
- Toggle switches for quick enable/disable

---

### 14. Webhooks

**Route:** `/webhooks`
**Access:** `SUPER_ADMIN`, `TENANT_ADMIN`

**API Endpoints:**
```
GET    /api/v1/webhooks                — List webhooks
POST   /api/v1/webhooks                — Create webhook
PATCH  /api/v1/webhooks/:id            — Update webhook
DELETE /api/v1/webhooks/:id            — Delete webhook
```

**UI Components:**

**Webhook List:**
- Table: URL, Events (badges), Active (toggle), Last Triggered, Actions
- "Create Webhook" button

**Create/Edit Webhook Form:**
- URL field (https://...)
- Events multi-select checkboxes (e.g., `user.created`, `policy.violation`, `ai.request`)
- Secret field (auto-generated, shown once)
- Active toggle

**Webhook Detail Page:**
- Config info
- Delivery logs table: Event, Status Code, Response Time, Timestamp
- Retry button for failed deliveries

---

### 15. Settings

**Route:** `/settings`
**Access:** All authenticated users

**UI Components:**

**Profile Tab:**
- Edit first name, last name
- Change password form (current password, new password, confirm)
- `PATCH /api/v1/users/:id`
- `POST /api/v1/auth/change-password` (if endpoint exists)

**Tenant Settings (Tenant Admin):**
- Edit tenant name, description
- `PATCH /api/v1/tenants/:id`

---

## Shared Components

### AppShell Layout

```
┌──────────────────────────────────────────────────────┐
│  Header (logo, search, notifications bell, user menu)│
├──────────┬───────────────────────────────────────────┤
│          │                                           │
│  Sidebar │              Main Content                 │
│  (nav)   │              (page content)               │
│          │                                           │
│          │                                           │
│          │                                           │
│          │                                           │
├──────────┴───────────────────────────────────────────┤
│  Footer (optional)                                    │
└──────────────────────────────────────────────────────┘
```

### Reusable Components to Build

| Component | Purpose |
|-----------|---------|
| `StatCard` | Number + label + icon + optional trend arrow |
| `DataTable` | Wrapper around TanStack Table with sorting, filtering, pagination |
| `Badge` | Role badges, status badges, policy type badges |
| `ConfirmDialog` | "Are you sure?" modals for delete actions |
| `EmptyState` | "No data" illustrations |
| `LoadingSpinner` | Full-page and inline loading states |
| `SearchInput` | Debounced search input |
| `DateRangePicker` | For monitoring date filters |
| `JsonViewer` | Collapsible JSON display for audit log details |
| `FileDropzone` | Drag-and-drop file upload area |
| `RoleBadge` | Color-coded role display |
| `StatusBadge` | Color-coded status display |
| `PageHeader` | Title + description + action buttons |

---

## Error Handling

### Global Error Boundary

Wrap your app in an error boundary to catch rendering errors:

```typescript
// Show a fallback UI when a component crashes
<ErrorBoundary fallback={<ErrorFallback />}>
  <App />
</ErrorBoundary>
```

### API Error Handling Pattern

```typescript
try {
  const response = await apiClient.post('/policies', policyData);
  toast.success('Policy created successfully');
} catch (error) {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const message = error.response?.data?.message;

    switch (status) {
      case 400:
        // Validation error — show field errors
        toast.error(message || 'Invalid input');
        break;
      case 403:
        toast.error(message || 'Access denied');
        break;
      case 409:
        toast.error(message || 'Resource already exists');
        break;
      case 429:
        toast.error('Too many requests. Please try again later.');
        break;
      default:
        toast.error('An unexpected error occurred');
    }
  }
}
```

### Policy Denial Handling in AI Chat

```typescript
try {
  const response = await apiClient.post('/ai/chat', chatPayload);
  // Show AI response
} catch (error) {
  if (error.response?.status === 403) {
    // Policy blocked the request — show inline
    addMessage({
      role: 'system',
      content: `⚠️ Request blocked: ${error.response.data.message}`,
      type: 'policy_denial',
    });
  }
}
```

---

## Environment Variables

### Frontend `.env.local`

```env
# API Connection
NEXT_PUBLIC_API_URL=http://localhost:3000

# App
NEXT_PUBLIC_APP_NAME=Secure AI Governance Platform
```

### Backend `.env` (relevant frontend settings)

Make sure these are set in the backend:

```env
# Allow frontend origin
CORS_ORIGINS=http://localhost:3001,http://localhost:3000

# Frontend URL (used for CORS and any redirects)
FRONTEND_URL=http://localhost:3001
```

---

## Quick Reference: All API Endpoints

| Module | Method | Endpoint | Access |
|--------|--------|----------|--------|
| **Auth** | POST | `/api/v1/auth/login` | Public |
| | POST | `/api/v1/auth/register` | Public |
| | POST | `/api/v1/auth/refresh` | Public |
| | POST | `/api/v1/auth/logout` | Authenticated |
| **Tenants** | GET | `/api/v1/tenants` | Super Admin |
| | POST | `/api/v1/tenants` | Super Admin |
| | GET | `/api/v1/tenants/:id` | Super Admin |
| | PATCH | `/api/v1/tenants/:id` | Super Admin |
| | DELETE | `/api/v1/tenants/:id` | Super Admin |
| | GET | `/api/v1/tenants/:id/stats` | Super Admin |
| | GET | `/api/v1/tenants/:id/users` | Super Admin |
| | POST | `/api/v1/tenants/:id/users` | Super Admin |
| **Users** | GET | `/api/v1/users` | Admin+ |
| | POST | `/api/v1/users` | Admin+ |
| | GET | `/api/v1/users/:id` | Admin+ |
| | PATCH | `/api/v1/users/:id` | Admin+ |
| | DELETE | `/api/v1/users/:id` | Admin+ |
| **Policies** | GET | `/api/v1/policies` | Tenant Admin+ |
| | POST | `/api/v1/policies` | Tenant Admin+ |
| | PATCH | `/api/v1/policies/:id` | Tenant Admin+ |
| | DELETE | `/api/v1/policies/:id` | Tenant Admin+ |
| | POST | `/api/v1/policies/:id/toggle` | Tenant Admin+ |
| | POST | `/api/v1/policies/evaluate` | Authenticated |
| | GET | `/api/v1/policies/:id/logs` | Tenant Admin+ |
| | GET | `/api/v1/policies/stats` | Tenant Admin+ |
| **AI Gateway** | POST | `/api/v1/ai/chat` | Authenticated |
| | GET | `/api/v1/ai/providers` | Authenticated |
| | GET | `/api/v1/ai/logs` | Tenant Admin+ |
| | GET | `/api/v1/ai/usage` | Tenant Admin+ |
| | POST | `/api/v1/ai/api-keys` | Tenant Admin+ |
| | GET | `/api/v1/ai/api-keys` | Tenant Admin+ |
| | POST | `/api/v1/ai/api-keys/:id/toggle` | Tenant Admin+ |
| | POST | `/api/v1/ai/api-keys/:id/rotate` | Tenant Admin+ |
| | DELETE | `/api/v1/ai/api-keys/:id` | Tenant Admin+ |
| **RAG** | POST | `/api/v1/rag/documents` | Developer+ |
| | GET | `/api/v1/rag/documents` | Authenticated |
| | GET | `/api/v1/rag/documents/stats` | Developer+ |
| | GET | `/api/v1/rag/documents/:id` | Authenticated |
| | DELETE | `/api/v1/rag/documents/:id` | Developer+ |
| | POST | `/api/v1/rag/documents/:id/reprocess` | Developer+ |
| | POST | `/api/v1/rag/search` | Authenticated |
| | POST | `/api/v1/rag/chat` | Authenticated |
| **Monitoring** | GET | `/api/v1/monitoring/dashboard` | Admin+ |
| | GET | `/api/v1/monitoring/usage` | Admin+ |
| | GET | `/api/v1/monitoring/compliance` | Admin+ |
| | GET | `/api/v1/monitoring/security` | Admin+ |
| | GET | `/api/v1/monitoring/tenants/:id/report` | Super Admin |
| **Audit** | GET | `/api/v1/audit` | Admin+ |
| **Notifications** | GET | `/api/v1/notifications` | Authenticated |
| | PATCH | `/api/v1/notifications/:id/read` | Authenticated |
| | POST | `/api/v1/notifications` | Admin+ |
| **Feature Flags** | GET | `/api/v1/feature-flags` | Super Admin |
| | POST | `/api/v1/feature-flags` | Super Admin |
| | PATCH | `/api/v1/feature-flags/:id` | Super Admin |
| | DELETE | `/api/v1/feature-flags/:id` | Super Admin |
| **Webhooks** | GET | `/api/v1/webhooks` | Tenant Admin+ |
| | POST | `/api/v1/webhooks` | Tenant Admin+ |
| | PATCH | `/api/v1/webhooks/:id` | Tenant Admin+ |
| | DELETE | `/api/v1/webhooks/:id` | Tenant Admin+ |
| **Health** | GET | `/api/v1/health` | Public |
| **File Upload** | POST | `/api/v1/files/upload` | Authenticated |

---

## Development Workflow

1. **Start backend**: `cd backend-api && npm run start:dev` (runs on port 3000)
2. **Start frontend**: `cd secure-gov-ui && npm run dev` (runs on port 3001)
3. **Use mock provider**: For AI chat testing, select `mock` provider — no API key needed
4. **Swagger docs**: Visit `http://localhost:3000/docs` for interactive API testing
5. **Test accounts**: Use the seeded accounts listed above for different role experiences
6. **CORS**: Already configured for `localhost:3001` — no extra setup needed

---

## Tips for Building

1. **Start with auth** — Login/register first, then the protected layout shell
2. **Build the dashboard next** — It touches the monitoring API and validates your auth flow end-to-end
3. **Policy management is the most complex form** — Use a dynamic form that switches based on policy type
4. **AI Chat is the showcase feature** — Invest in good UX here (markdown rendering, loading states, policy denial display)
5. **RAG needs polling** — Documents process asynchronously; poll status or use optimistic UI
6. **Use the mock provider** — You can test the entire AI flow without any external API keys
7. **Role-test everything** — Login as each role type and verify the UI shows/hides correctly
