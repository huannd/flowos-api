# ⚡ FlowOS API

> NestJS backend cho FlowOS — Workflow Automation SaaS. Cung cấp 44+ REST API endpoints, SSE streaming, JWT auth, n8n integration, và encrypted credential storage.

---

## 📐 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       FlowOS API (:4000)                     │
│                                                              │
│  ┌─────────┐  ┌──────────┐  ┌───────────┐  ┌────────────┐  │
│  │  Auth    │  │Templates │  │Automation │  │  Billing   │  │
│  │  Module  │  │  Module  │  │  Module   │  │  Module    │  │
│  └────┬────┘  └────┬─────┘  └─────┬─────┘  └─────┬──────┘  │
│       │            │              │               │          │
│  ┌────┴────┐  ┌────┴─────┐  ┌────┴──────┐  ┌────┴──────┐  │
│  │Execution│  │Credential│  │  Webhook  │  │  Admin    │  │
│  │  Module │  │  Module  │  │  Module   │  │  Module   │  │
│  └────┬────┘  └────┬─────┘  └─────┬─────┘  └─────┬─────┘  │
│       │            │              │               │          │
│  ═════╤════════════╤══════════════╤═══════════════╤════════  │
│       │        CORE SERVICES      │                          │
│  ┌────┴────┐  ┌─────────┐  ┌─────┴─────┐  ┌───────────┐   │
│  │ Prisma  │  │  Redis  │  │ n8nClient │  │   SSE     │   │
│  │ Service │  │ Service │  │  Service  │  │  Service  │   │
│  └─────────┘  └─────────┘  └───────────┘  └───────────┘   │
│       │            │              │                          │
└───────┼────────────┼──────────────┼──────────────────────────┘
        ▼            ▼              ▼
   PostgreSQL     Redis          n8n Engine
    (:5432)      (:6379)         (:5679)
```

---

## 📁 Cấu trúc thư mục

```
flowos-api/
├── prisma/
│   ├── schema.prisma           # 10 models, 5 enums, indexes
│   └── seed.ts                 # Seed data (plans, categories, templates, admin)
│
├── src/
│   ├── main.ts                 # Bootstrap: Helmet, CORS, Swagger, Versioning
│   ├── app.module.ts           # Root module (10 feature modules + 6 core providers)
│   │
│   ├── core/                   # Shared infrastructure services
│   │   ├── database/
│   │   │   └── prisma.service.ts        # Prisma client lifecycle
│   │   ├── redis/
│   │   │   └── redis.service.ts         # Redis client + cache + pub/sub + rate limit + quota
│   │   ├── n8n/
│   │   │   └── n8n-client.service.ts    # n8n REST API integration
│   │   ├── sse/
│   │   │   └── sse.service.ts           # Server-Sent Events hub
│   │   ├── quota/
│   │   │   └── quota.service.ts         # Quota checking + enforcement
│   │   └── security/
│   │       └── crypto.service.ts        # AES-256-GCM encryption/decryption
│   │
│   ├── common/                 # Shared utilities
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts        # JWT Bearer authentication
│   │   │   ├── roles.guard.ts           # RBAC (ADMIN, SUPER_ADMIN)
│   │   │   └── throttle.guard.ts        # Per-route rate limiting
│   │   ├── middleware/
│   │   │   ├── request-id.middleware.ts  # X-Request-Id tracing
│   │   │   └── request-logger.middleware.ts # Structured HTTP logging
│   │   ├── filters/
│   │   │   └── all-exceptions.filter.ts  # Global exception handler
│   │   └── decorators/
│   │       └── roles.decorator.ts        # @Roles() metadata
│   │
│   └── modules/                # Feature modules
│       ├── health/             # Health probes (live, ready, detailed)
│       ├── auth/               # Register, Login (JWT)
│       ├── user/               # Profile CRUD
│       ├── template/           # Marketplace (list, categories, detail)
│       ├── automation/         # Run, Cancel, Retry workflows
│       ├── execution/          # History, Stats, SSE streaming
│       ├── credential/         # Encrypted credential CRUD
│       ├── billing/            # Plans, Subscription, Quota, Invoices, Payment webhook
│       ├── webhook/            # n8n callbacks (execution-finished, node-event)
│       └── admin/              # Template CRUD, Users, Analytics, Audit logs, System health
│
├── Dockerfile                  # Multi-stage production build
├── .env.example                # Environment template
└── package.json
```

---

## 📋 API Endpoints Checklist

### 🏥 Health (`/api/health`)

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|--------|
| 1 | `GET` | `/health` | ❌ | Detailed health (memory, CPU, latency) |
| 2 | `GET` | `/health/live` | ❌ | Liveness probe (k8s) |
| 3 | `GET` | `/health/ready` | ❌ | Readiness probe (DB + Redis) |

### 🔐 Auth (`/api/auth`)

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|--------|
| 4 | `POST` | `/auth/register` | ❌ | Đăng ký (email, password, fullName) |
| 5 | `POST` | `/auth/login` | ❌ | Đăng nhập → JWT accessToken |

### 👤 User (`/api/user`)

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|--------|
| 6 | `GET` | `/user/profile` | ✅ | Lấy profile |
| 7 | `PUT` | `/user/profile` | ✅ | Cập nhật profile |

### 📋 Templates (`/api/templates`)

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|--------|
| 8 | `GET` | `/templates` | ✅ | Marketplace — list + filter + search |
| 9 | `GET` | `/templates/categories` | ✅ | Danh sách categories |
| 10 | `GET` | `/templates/:id` | ✅ | Chi tiết template + inputSchema |

### 🚀 Automations (`/api/automations`)

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|--------|
| 11 | `POST` | `/automations/run` | ✅ | Chạy workflow (10-step flow) |
| 12 | `POST` | `/automations/:id/cancel` | ✅ | Hủy execution đang chạy |
| 13 | `POST` | `/automations/:id/retry` | ✅ | Retry execution thất bại |
| 14 | `GET` | `/automations/history` | ✅ | Lịch sử (= executions alias) |

### 📊 Executions (`/api/executions`)

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|--------|
| 15 | `GET` | `/executions` | ✅ | Danh sách (pagination, filter status) |
| 16 | `GET` | `/executions/stats` | ✅ | Thống kê (success, error, running counts) |
| 17 | `GET` | `/executions/:id` | ✅ | Chi tiết execution |
| 18 | `GET` | `/executions/:id/stream` | ✅ | **SSE** — Live execution stream |
| 19 | `GET` | `/executions/stream/dashboard` | ✅ | **SSE** — Dashboard realtime updates |

### 🔑 Credentials (`/api/credentials`)

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|--------|
| 20 | `GET` | `/credentials` | ✅ | Danh sách credentials (no encrypted data) |
| 21 | `GET` | `/credentials/types` | ✅ | Supported credential types |
| 22 | `POST` | `/credentials` | ✅ | Tạo credential (AES-256-GCM encrypted) |
| 23 | `PUT` | `/credentials/:id` | ✅ | Cập nhật credential |
| 24 | `DELETE` | `/credentials/:id` | ✅ | Xóa credential |
| 25 | `GET` | `/credentials/internal/:userId/:type` | 🔒 | Internal: lấy decrypted (n8n use) |
| 26 | `GET` | `/credentials/internal/:userId/check/:type` | 🔒 | Internal: check existence |

### 💳 Billing (`/api/billing`)

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|--------|
| 27 | `GET` | `/billing/plans` | ❌ | Danh sách gói (Free, Pro, Business) |
| 28 | `GET` | `/billing/subscription` | ✅ | Subscription hiện tại |
| 29 | `GET` | `/billing/quota` | ✅ | Quota usage tháng hiện tại |
| 30 | `POST` | `/billing/upgrade` | ✅ | Nâng cấp / đổi gói |
| 31 | `POST` | `/billing/cancel` | ✅ | Hủy subscription |
| 32 | `GET` | `/billing/invoices` | ✅ | Lịch sử hóa đơn (12 tháng) |
| 33 | `POST` | `/billing/webhook/payment` | 🔒 | Payment provider callback |

### 🔔 Webhooks (`/api/webhooks`)

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|--------|
| 34 | `POST` | `/webhooks/n8n/execution-finished` | 🔒 | Callback khi n8n execution done |
| 35 | `POST` | `/webhooks/n8n/node-event` | 🔒 | Realtime node progress events |

### 🛡️ Admin (`/api/admin`) — RBAC: `ADMIN` / `SUPER_ADMIN`

| # | Method | Endpoint | Auth | Mô tả |
|---|--------|----------|------|--------|
| 36 | `POST` | `/admin/templates` | 🔒 | Tạo template |
| 37 | `PUT` | `/admin/templates/:id` | 🔒 | Sửa template |
| 38 | `DELETE` | `/admin/templates/:id` | 🔒 | Xóa template |
| 39 | `GET` | `/admin/users` | 🔒 | List users (search, pagination) |
| 40 | `GET` | `/admin/analytics` | 🔒 | Dashboard analytics overview |
| 41 | `GET` | `/admin/analytics/execution-trends` | 🔒 | Execution trend data (chart) |
| 42 | `GET` | `/admin/analytics/top-templates` | 🔒 | Top templates by usage |
| 43 | `GET` | `/admin/analytics/user-distribution` | 🔒 | Users by plan & role |
| 44 | `GET` | `/admin/audit-logs` | 🔒 | Paginated audit logs |
| 45 | `GET` | `/admin/system/health` | 🔒 | Detailed system health (DB, Redis, n8n) |

> **Legend:** ❌ Public | ✅ JWT Required | 🔒 Internal/Admin

---

## 🔄 Luồng hoạt động chính

### 1. Automation Flow (10 bước)

```
User (Dashboard)
  │
  ├─1→ POST /api/automations/run { templateId, inputData }
  │
  API
  ├─2→ Validate JWT + Check quota
  ├─3→ Fetch template + inputSchema validation
  ├─4→ Create Execution (status: PENDING)
  ├─5→ Inject user credentials → n8n Internal API
  ├─6→ Trigger n8n webhook → Start workflow
  ├─7→ Update Execution (status: RUNNING)
  ├─8→ SSE stream updates → Dashboard
  │
  n8n Worker
  ├─9→ Execute workflow → callback to API
  │         POST /api/webhooks/n8n/execution-finished
  │
  API
  └─10→ Update Execution (status: SUCCESS/ERROR)
        → Publish SSE event → Dashboard receives result
```

### 2. SSE Streaming

```
Dashboard                    API                      Redis
  │                          │                         │
  ├─ GET /executions/:id/stream ──→                    │
  │                          ├─ Register SSE client    │
  │                          │                         │
  │                          │   n8n webhook arrives   │
  │                          ├─ Publish Redis channel ─┤
  │                          │                         │
  │   ← SSE: status event ──┤ ← Subscribe channel ────┤
  │   ← SSE: node_started ──┤                         │
  │   ← SSE: node_finished ─┤                         │
  │   ← SSE: completed ─────┤                         │
  │                          ├─ Close SSE connection   │
  └──────────────────────────┘                         │
```

### 3. Billing Flow

```
User → POST /billing/upgrade { planId }
  │
  API validates plan → Creates/Updates Subscription → AuditLog
  │
  Payment Provider → POST /billing/webhook/payment
  │     HMAC-SHA256 signature verification
  │     status=success → Activate subscription
  │     status=failed  → Log failure
  └─ Response → User Dashboard updates quota
```

---

## 🚀 Deployment

### Development

```bash
# 1. Prerequisites: flowos-infra running (PostgreSQL + Redis + n8n)
cd ../flowos-infra && docker compose up -d

# 2. Configure
cp .env.example .env
# Sửa giá trị nếu cần

# 3. Install & Setup DB
npm install
npx prisma generate
npx prisma migrate dev --name init

# 4. Seed data
npx ts-node prisma/seed.ts

# 5. Start dev server
npm run start:dev
# → API: http://localhost:4000/api
# → Swagger: http://localhost:4000/docs
```

### Production

```bash
# Build Docker image
docker build -t flowos-api:latest .

# Run
docker run -d \
  --name flowos-api \
  --env-file .env \
  -p 4000:4000 \
  flowos-api:latest

# Or use docker-compose.prod.yml from flowos-infra
```

### Useful Commands

```bash
# Database
npx prisma studio                    # GUI browser
npx prisma migrate dev --name xxx    # New migration
npx prisma migrate deploy            # Apply migrations (prod)
npx prisma db seed                   # Re-seed

# Development
npm run start:dev                    # Hot reload
npm run build                        # Compile TypeScript
npm run start:prod                   # Run compiled

# Testing
npm run test                         # Unit tests
npm run test:e2e                     # E2E tests
```

---

## 🔐 Security

| Layer | Implementation |
|-------|---------------|
| **Auth** | JWT Bearer (bcrypt hashed passwords) |
| **RBAC** | `@Roles('ADMIN')` decorator + RolesGuard |
| **Encryption** | AES-256-GCM for user credentials |
| **Rate Limiting** | Redis sliding window (ThrottleGuard) |
| **Input Validation** | class-validator + whitelist + forbidNonWhitelisted |
| **CORS** | Configurable origin list |
| **Headers** | Helmet (HSTS, X-Frame-Options, etc.) |
| **Request Tracing** | X-Request-Id middleware |

---

## 📦 Database Models

| Model | Mô tả |
|-------|--------|
| `User` | Users (email, passwordHash, systemRole) |
| `Category` | Template categories (Social Media, AI Tools, ...) |
| `Template` | Workflow templates (inputSchema, n8nWorkflowId) |
| `Execution` | Execution tracking (status, inputData, outputData) |
| `UserCredential` | Encrypted credentials (AES-256-GCM) |
| `Plan` | Pricing plans (Free, Pro, Business) |
| `Subscription` | User subscriptions (planId, status, dates) |
| `UsageLog` | Monthly execution counts |
| `AuditLog` | Admin action audit trail |
| `SystemConfig` | System key-value configs |
