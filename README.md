<p align="center">
  <img src="frontend/public/logo.svg" alt="Cognira" width="220" />
</p>

<p align="center">
  <strong>CX Intelligence Platform</strong><br/>
  Field studies · AI visit validation · Shelf audit · RAG · Call centre · Planogram · Real-time WebRTC
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-BUSL--1.1-blue.svg" alt="License: BUSL-1.1"/></a>
  <a href="https://github.com/biulino/cognira/actions"><img src="https://github.com/biulino/cognira/actions/workflows/ci.yml/badge.svg" alt="CI"/></a>
  <img src="https://img.shields.io/badge/python-3.12-blue" alt="Python 3.12"/>
  <img src="https://img.shields.io/badge/next.js-14-black" alt="Next.js 14"/>
  <img src="https://img.shields.io/badge/postgres-16+pgvector-336791" alt="PostgreSQL 16"/>
  <a href="mailto:me@otokura.online"><img src="https://img.shields.io/badge/contact-me%40otokura.online-informational" alt="Contact"/></a>
</p>

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Feature Matrix — Community vs Pro](#feature-matrix--community-vs-pro)
4. [AI Modules](#ai-modules)
5. [API Reference](#api-reference)
6. [Roles & Permissions](#roles--permissions)
7. [Quick Start](#quick-start)
8. [Configuration Reference](#configuration-reference)
9. [Database](#database)
10. [Development](#development)
11. [Testing](#testing)
12. [Deployment](#deployment)
13. [Security](#security)
14. [Licensing & Commercial Use](#licensing--commercial-use)
15. [Contributing](#contributing)

---

## Overview

**Cognira** is an open-core SaaS platform built for consumer-goods companies, market-research agencies, and field-force operators. It manages the full lifecycle of field studies: questionnaire design, visit scheduling, on-site data capture, AI-powered quality control, client reporting, and operational analytics.

### Core capabilities

| Domain | What it does |
|---|---|
| **Studies & Waves** | Create research studies with configurable evaluation grids, assign fieldwork waves, plan visit quotas |
| **Visit Management** | Full state-machine lifecycle (draft → submitted → validated → approved/rejected), GPS check-in, barcode scan |
| **Questionnaires** | Multi-language questionnaires (PT/EN/ES/FR) with branching logic, public survey links, offline-capable |
| **Photo AI** | GPT-4o Vision analysis of visit photos — compliance verdicts, automatic flagging |
| **Shelf Audit** | EAN/QR barcode scanning, facing counts, planogram comparison, AI deviation analysis |
| **Call Centre** | Whisper STT audio transcription + GPT scoring against evaluation templates |
| **RAG Search** | Semantic search over ingested study documents (pgvector embeddings) |
| **AI Agent** | Conversational chat agent with tool use for logistics, data queries, and planning |
| **Analyst Scoring** | Predictive quality scores, anomaly detection, personalised AI coaching |
| **Client Portal** | White-label portal per client with SLA dashboard, custom branding/domain |
| **Internal Chat** | Real-time team messaging with WebRTC P2P voice calls (coturn TURN) |
| **Webhooks & API** | External REST API with API-key auth, webhook subscriptions for events |
| **Multi-tenancy** | Full tenant isolation at DB level, per-tenant plans & module gating |
| **SSO / SAML 2.0** | Authentik, Keycloak, Azure AD, Google Workspace |

---

## Architecture

```
Internet
    │
    ▼
Nginx 1.27 (reverse proxy, TLS termination)
    ├──▶ Next.js 14  (frontend · port 3000)
    └──▶ FastAPI     (backend API · port 8000)
              │
              ├──▶ PostgreSQL 16 + pgvector  (primary datastore)
              ├──▶ MinIO                      (object storage — photos, audio, exports)
              ├──▶ ClamAV                     (antivirus scan on every upload)
              └──▶ Coturn                     (TURN server for WebRTC P2P voice)
```

### Technology stack

| Layer | Technology | Version |
|---|---|---|
| Frontend | Next.js + React + TypeScript + Tailwind CSS | 14 / 18 |
| Backend API | FastAPI + SQLAlchemy (async) + Pydantic | 0.115 / 2.0 / 2.10 |
| Runtime | Python | 3.12 |
| Database | PostgreSQL + pgvector | 16 |
| ORM migrations | Alembic | 1.14 |
| Object storage | MinIO (S3-compatible) | latest |
| Antivirus | ClamAV | stable |
| Reverse proxy | Nginx | 1.27-alpine |
| TURN server | Coturn | latest |
| AI | OpenAI (GPT-4o, GPT-4o-mini, Whisper, text-embedding-3-small) | SDK 1.61 |
| Auth | JWT (access 15 min + refresh 7 days) + TOTP MFA + SSO/OIDC/SAML | — |
| Push | Web Push (VAPID) via pywebpush | — |
| Exports | WeasyPrint (PDF) + openpyxl (Excel) | — |
| i18n | Native React context (PT / EN / ES / FR) | — |
| Tests | pytest-asyncio + Playwright (E2E) | — |
| CI | GitHub Actions | — |

---

## Feature Matrix — Community vs Pro

Set `EDITION=community` (default) or `EDITION=pro` in your `.env`. Pro requires a valid `COGNIRA_LICENSE_KEY`.

| Feature | Community | Pro |
|---|:---:|:---:|
| Studies, waves, visits, questionnaires | ✅ | ✅ |
| Analyst management | ✅ | ✅ |
| Photo upload (no AI analysis) | ✅ | ✅ |
| Excel / PDF exports | ✅ | ✅ |
| Internal chat (text) | ✅ | ✅ |
| Client portal (basic) | ✅ | ✅ |
| REST API (read-only) | ✅ | ✅ |
| **Photo AI analysis (GPT-4o Vision)** | ❌ | ✅ |
| **AI visit validation & auto-QC** | ❌ | ✅ |
| **AI visit planning** | ❌ | ✅ |
| **AI narrative report generation** | ❌ | ✅ |
| **AI insights, word cloud, sentiment** | ❌ | ✅ |
| **Analyst predictive scoring** | ❌ | ✅ |
| **Analyst anomaly detection** | ❌ | ✅ |
| **AI personalised coaching** | ❌ | ✅ |
| **Call centre (Whisper + GPT scoring)** | ❌ | ✅ |
| **Shelf audit AI analysis** | ❌ | ✅ |
| **Planogram AI comparison** | ❌ | ✅ |
| **RAG semantic search** | ❌ | ✅ |
| **AI agent (conversational)** | ❌ | ✅ |
| **Multi-tenancy** | ❌ | ✅ |
| **White-label branding per tenant** | ❌ | ✅ |
| **API keys & webhooks** | ❌ | ✅ |
| **SSO / SAML 2.0** | ❌ | ✅ |
| **Web push notifications** | ❌ | ✅ |
| **Superadmin panel** | ❌ | ✅ |
| **WebRTC P2P voice calls** | ❌ | ✅ |

> **Upgrade / get a licence key:** [me@otokura.online](mailto:me@otokura.online)

---

## AI Modules

All AI features require `EDITION=pro` and a valid `OPENAI_API_KEY`. Endpoints return HTTP `402 Payment Required` when called on `community` edition.

| Module | Endpoint | Model | Description |
|---|---|---|---|
| **Módulo 3** — Photo AI | `POST /api/visitas/{id}/fotos/{fid}/analisar` | GPT-4o Vision | Analyses visit photo; returns compliance verdict, flags anomalies, persists result |
| **Módulo 4** — Anomaly Detection | `GET /api/analistas/anomalias` | GPT-4o | Detects outlier analysts by score deviation over a configurable time window |
| **Módulo 6** — AI Validation | `POST /api/visitas/{id}/validar-ia` | GPT-4o | Analyses all responses; flags inconsistencies; recommends approve / correct / review |
| **Módulo 7** — Predictive Score | `GET /api/analistas/{id}/score-preditivo` | GPT-4o | 90-day predictive quality score for a single analyst |
| **Módulo 8** — Visit Planning | `POST /api/estudos/{id}/ondas/{oid}/planear-ia` | GPT-4o | AI-generated optimal visit assignment plan for a wave |
| **Módulo 10** — Word Cloud | `GET /api/estudos/{id}/word-cloud` | text-embedding | Keyword frequency extraction from open-text responses |
| **Módulo 11** — Temporal Comparison | `GET /api/estudos/{id}/comparativo-temporal` | GPT-4o-mini | Wave-over-wave trend analysis |
| **Módulo 12** — Sentiment | `GET /api/estudos/{id}/sentimento` | GPT-4o-mini | NLP sentiment analysis over all open-text visit responses |
| **Módulo 13** — Auto-QC | `POST /api/visitas/{id}/auto-qc` | GPT-4o | Flags suspicious or internally inconsistent responses before human review |
| **Módulo 14** — AI Coaching | `GET /api/analistas/{id}/coaching-ia` | GPT-4o | Personalised 90-day development plan for each analyst |
| **Intelligence Module 1** — Report | `POST /api/estudos/{id}/relatorio-ia` | GPT-4o | Generates a full narrative Portuguese/English executive report |
| **Intelligence Module 5** — Insights | `GET /api/estudos/{id}/insights` | GPT-4o | Real-time strategic insights for a study |
| **Call Centre AI** | `POST /api/callcenter/upload` | Whisper + GPT-4o | STT transcription + scorecard extraction against a template |
| **Shelf Audit AI** | `POST /api/shelf-audit/{visita_id}/analisar-ia` | GPT-4o | Analyses all shelf items for a visit; detects facings, gaps, compliance breaches |
| **Planogram AI** | `POST /api/planogramas/{id}/comparar` | GPT-4o Vision | Side-by-side comparison of reference planogram vs. visit photo |
| **RAG Ingest** | `POST /api/rag/ingest` | text-embedding-3-small | Chunk a document + generate pgvector embedding |
| **RAG Search** | `POST /api/rag/search` | text-embedding-3-small | Semantic similarity search (top-k) over ingested documents |
| **AI Agent** | `POST /api/chat` | GPT-4o (function calling) | Conversational agent with tools: logistics preview, data queries, study planning |

---

## API Reference

Interactive Swagger UI: `http://localhost:8088/api/docs`
ReDoc: `http://localhost:8088/api/redoc`

### Endpoint groups

| Prefix | Description |
|---|---|
| `/api/auth` | Login, logout, refresh, MFA setup, password change, SSO |
| `/api/auth/saml` | SAML 2.0 SP — metadata, login initiation, ACS, SLO |
| `/api/estudos` | Studies CRUD, waves, grids, AI reports, insights, planning |
| `/api/visitas` | Visits CRUD, state machine, GPS check-in, AI validation, exports |
| `/api/visitas/{id}/fotos` | Photo upload, listing, deletion, AI analysis |
| `/api/questionarios` | Questionnaire CRUD, translations, public survey submission |
| `/api/analistas` | Analyst management, scoring, coaching, anomalies, blacklist |
| `/api/clientes` | Client CRUD, SLA config, module subscription |
| `/api/estabelecimentos` | Establishment management (geo coords, barcode) |
| `/api/callcenter` | Audio upload, transcription pipeline, templates, config |
| `/api/shelf-audit` | Shelf audit items, AI analysis, Excel export |
| `/api/planogramas` | Planogram CRUD, photo upload, AI comparison |
| `/api/rag` | Document ingest, semantic search, document management |
| `/api/chat` | AI agent chat sessions, logistics preview & execute |
| `/api/chat-interno` | Internal team messaging (WebSocket + REST history) |
| `/api/mensagens` | Broadcast messages |
| `/api/alertas` | Alert management |
| `/api/formacoes` | Training management |
| `/api/pagamentos` | Payment records |
| `/api/portal` | Client portal — dashboard, trends, map, reports |
| `/api/public/survey` | Public survey submission (no auth) |
| `/api/push` | Web push subscription management |
| `/api/webhooks` | API key management, webhook subscriptions, delivery log |
| `/api/branding` | Platform & per-tenant branding configuration |
| `/api/superadmin` | Tenant management, plan management, MRR stats |
| `/api/onboarding` | Onboarding wizard steps |
| `/api/configuracoes` | System configuration key-value store |
| `/api/audit` | Immutable audit log |
| `/api/ai-providers` | AI provider configuration |
| `/api/ingest` | Bulk data ingest |
| `/api/wizard` | AI study wizard |
| `/api/external` | External REST API (API-key authenticated) |
| `/api/edition` | Edition info — features available/locked |
| `/api/theme` | Legacy theme endpoint (white-label CSS vars) |
| `/api/health` | Health check |
| `/ws` | WebSocket — real-time updates + WebRTC signalling |

### Authentication

All endpoints (except `/api/auth/login`, `/api/public/*`, `/api/health`, `/api/edition`, `/api/theme`) require a `Bearer` token in the `Authorization` header.

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:8088/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Cognira@Admin2026"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Use the token
curl -H "Authorization: Bearer $TOKEN" http://localhost:8088/api/estudos
```

External API access uses `X-Api-Key: <key>` header instead (Pro only).

---

## Roles & Permissions

| Role | Description | Key permissions |
|---|---|---|
| `admin` | Platform administrator | Full access to all resources and AI features |
| `coordenador` | Study coordinator | Create/manage studies, validate visits, access AI modules |
| `validador` | Field validator | Review and validate submitted visits, photo AI |
| `analista` | Field analyst | Submit visits, upload photos, view own data |
| `cliente` | Client stakeholder | Read-only client portal, dashboards, reports |
| `utilizador` | Standard user | Basic access, configurable per module subscription |

Superadmin is a flag (`is_superadmin=True`) on top of any role, granting access to the `/api/superadmin` panel (Pro only).

---

## Quick Start

### Prerequisites

- Docker ≥ 24.0 and Docker Compose v2
- OpenAI API key (for Pro AI features)
- Domain (optional — platform works on localhost/IP)

### 1. Clone & configure

```bash
git clone https://github.com/biulino/cognira.git
cd cognira
cp .env.example .env
```

Edit `.env` — at minimum, change these values:

```bash
# Required — generate with: openssl rand -hex 64
JWT_SECRET=your_strong_secret_here

# Required — generate with: python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
PII_KEY=your_fernet_key_here

# Required for AI features (Pro edition)
OPENAI_API_KEY=sk-your-key-here
EDITION=community   # or: pro (requires COGNIRA_LICENSE_KEY)

# Required — change from defaults
POSTGRES_PASSWORD=your_db_password
MINIO_ROOT_PASSWORD=your_minio_password
```

### 2. Start

```bash
docker compose up -d
```

First boot takes ~60 seconds — Alembic runs migrations automatically.

### 3. Seed demo data (optional)

```bash
docker compose exec backend python -m app.seed
```

This creates demo users, studies, clients, and establishments.

### 4. Access

| URL | Description |
|---|---|
| `http://localhost:8088` | Main application |
| `http://localhost:8088/api/docs` | Swagger UI |
| `http://localhost:9001` | MinIO console (direct) |

### Demo credentials (after seeding)

| Username | Password | Role |
|---|---|---|
| `admin` | `Cognira@Admin2026` | Admin |
| `coordenador` | `Cognira@Coord2026` | Coordenador |
| `validador` | `Cognira@Valid2026` | Validador |
| `analista1` | `Cognira@Anal2026` | Analista |
| `cliente_vodafone` | `Cognira@Vodafone26` | Cliente |

---

## Configuration Reference

All configuration is via environment variables. Copy `.env.example` to `.env` and fill in the values.

### Core

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | PostgreSQL async URL (`postgresql+asyncpg://...`) |
| `JWT_SECRET` | `CHANGE_ME` | JWT signing secret — **must change before deploying** |
| `JWT_ALGORITHM` | `HS256` | JWT algorithm |
| `JWT_ACCESS_MINUTES` | `15` | Access token lifetime (minutes) |
| `JWT_REFRESH_DAYS` | `7` | Refresh token lifetime (days) |
| `PII_KEY` | `CHANGE_ME` | Fernet key for PII field encryption — **must change before deploying** |
| `ENVIRONMENT` | `development` | Set to `production` to enable fatal security checks on startup |

### Edition & Licensing

| Variable | Default | Description |
|---|---|---|
| `EDITION` | `community` | `community` or `pro` |
| `COGNIRA_LICENSE_KEY` | — | Pro licence key (contact [me@otokura.online](mailto:me@otokura.online)) |
| `LICENSE_SIGNING_KEY` | `cognira-dev-signing-key` | HMAC signing key for licence verification |
| `COGNIRA_TELEMETRY` | `on` | Set `off` to disable startup telemetry ping |

### AI

| Variable | Default | Description |
|---|---|---|
| `OPENAI_API_KEY` | — | OpenAI API key |

### Email (SMTP)

| Variable | Default | Description |
|---|---|---|
| `SMTP_HOST` | — | SMTP server hostname |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USER` | — | SMTP username |
| `SMTP_PASSWORD` | — | SMTP password |
| `SMTP_FROM` | — | From address for outgoing email |

### Object Storage (MinIO)

| Variable | Default | Description |
|---|---|---|
| `MINIO_ENDPOINT` | `minio:9000` | MinIO endpoint (internal Docker network) |
| `MINIO_ROOT_USER` | `minioadmin` | MinIO root username |
| `MINIO_ROOT_PASSWORD` | `CHANGE_ME` | MinIO root password |
| `MINIO_BUCKET` | `estudos-mercado` | Default bucket name |

### Antivirus

| Variable | Default | Description |
|---|---|---|
| `CLAMAV_HOST` | `clamav` | ClamAV daemon hostname |
| `CLAMAV_PORT` | `3310` | ClamAV daemon port |

### Push Notifications (Pro)

| Variable | Default | Description |
|---|---|---|
| `VAPID_PRIVATE_KEY` | — | VAPID private key (generate with `py-vapid`) |
| `VAPID_PUBLIC_KEY` | — | VAPID public key |
| `VAPID_EMAIL` | — | Admin email for VAPID contact |

### WebRTC / TURN (Pro)

| Variable | Default | Description |
|---|---|---|
| `TURN_HOST` | — | Coturn hostname or IP |
| `TURN_SECRET` | `CHANGE_ME` | Shared TURN secret |

### SSO / OIDC (Pro)

| Variable | Default | Description |
|---|---|---|
| `SSO_ENABLED` | `false` | Enable SSO login button on login page |
| `SSO_PROVIDER_NAME` | `Authentik` | Display name on the login button |
| `SSO_CLIENT_ID` | — | OAuth2 client ID |
| `SSO_CLIENT_SECRET` | — | OAuth2 client secret |
| `SSO_AUTH_URL` | — | IdP authorization endpoint |
| `SSO_TOKEN_URL` | — | IdP token endpoint |
| `SSO_USERINFO_URL` | — | IdP userinfo endpoint |
| `SSO_REDIRECT_URI` | — | Callback URL (must match IdP config) |
| `SSO_DEFAULT_ROLE` | `utilizador` | Default role assigned to new SSO users |

---

## Database

### Stack

- **PostgreSQL 16** with extensions `pgcrypto` (for PII encryption helpers) and **pgvector** (for RAG embeddings)
- Migrations managed with **Alembic** — run automatically on container start
- PII fields (emails, phone numbers, names) are encrypted at rest using Fernet symmetric encryption via `PII_KEY`

### Running migrations manually

```bash
# Apply all pending migrations
docker compose exec backend alembic upgrade head

# Check current revision
docker compose exec backend alembic current

# Create a new migration
docker compose exec backend alembic revision --autogenerate -m "description"

# Roll back one step
docker compose exec backend alembic downgrade -1
```

### Backup & restore

```bash
# Backup (pgbackup service runs daily via cron; manual trigger):
make backup

# Or manually:
docker compose exec postgres pg_dump -U emercado estudos_mercado | gzip > backup_$(date +%Y%m%d).sql.gz

# Restore:
gunzip -c backup_20260101.sql.gz | docker compose exec -T postgres psql -U emercado estudos_mercado
```

### Schema overview

| Table group | Tables |
|---|---|
| Users & Auth | `utilizadores`, `token_blacklist` |
| Tenants & Plans | `tenants`, `planos_tenant`, `clientes`, `portal_clientes` |
| Studies | `estudos`, `ondas`, `filtros_estudo`, `campos_configuracao` |
| Visits | `visitas`, `campos_visita`, `caracterizacao_cache` |
| Evaluation | `grelhas`, `secoes_grelha`, `criterios_grelha` |
| Photos | `fotos_visita` |
| Questionnaires | `questionarios`, `questoes`, `respostas_publicas` |
| Analysts | `analistas`, `chilling_periods`, `blacklist_estabelecimentos` |
| Establishments | `estabelecimentos` |
| Clients | `clientes`, `permissoes_estudo` |
| Call Centre | `chamadas_callcenter`, `configuracao_callcenter`, `templates_callcenter` |
| Shelf Audit | `shelf_audit_items` |
| Planograms | `planogramas`, `comparacoes_planograma` |
| RAG | `rag_embeddings` |
| Chat | `chat_sessoes`, `mensagens_chat_interno`, `grupos_chat` |
| Webhooks | `api_keys`, `webhook_subscriptions`, `webhook_deliveries` |
| Push | `push_subscriptions` |
| Settings | `configuracoes_sistema` |
| Audit | `audit_log` |
| Training | `formacoes`, `formacao_analistas` |
| Payments | `pagamentos` |

---

## Development

### Local setup (without Docker)

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Requires a running PostgreSQL + MinIO
export DATABASE_URL=postgresql+asyncpg://emercado:secret@localhost:5432/cognira_dev
export JWT_SECRET=dev-secret
export PII_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
export MINIO_ENDPOINT=localhost:9000
export OPENAI_API_KEY=sk-...

uvicorn app.main:app --reload --port 8000
```

```bash
# Frontend
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000/api npm run dev
```

### Make targets

```bash
make up          # docker compose up -d
make down        # docker compose down
make restart     # down + up
make logs        # follow all logs
make migrate     # run alembic upgrade head
make seed        # run demo data seed
make backup      # pg_dump to ./backups/
make shell-db    # psql shell in postgres container
make shell-be    # bash shell in backend container
make test        # run pytest in backend container
```

### Project structure

```
cognira/
├── backend/
│   ├── app/
│   │   ├── ai/             # AI modules (intelligence.py, agent.py, provider_factory.py)
│   │   ├── auth/           # JWT helpers, password hashing, TOTP
│   │   ├── models/         # SQLAlchemy ORM models (25 modules)
│   │   ├── routers/        # FastAPI routers (36 route modules)
│   │   ├── schemas/        # Pydantic request/response schemas
│   │   ├── services/       # Business logic (state machine, PII, webhooks, storage, email…)
│   │   ├── config.py       # Pydantic settings from env vars
│   │   ├── database.py     # Async SQLAlchemy engine + session factory
│   │   ├── deps.py         # FastAPI dependency injection (auth, roles, tenant filter)
│   │   ├── edition.py      # Edition gating — require_pro(), startup_check(), telemetry
│   │   ├── main.py         # FastAPI app, lifespan, router registration
│   │   ├── seed.py         # Demo data seeder
│   │   └── ws.py           # WebSocket handler (real-time + WebRTC signalling)
│   ├── alembic/            # Migration scripts (25 revisions)
│   ├── tests/              # pytest test suite (10 test modules)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/            # Next.js App Router pages
│   │   ├── components/     # Shared React components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # API clients, branding context, utilities
│   │   └── locales/        # i18n strings (PT/EN/ES/FR)
│   └── public/             # Static assets, logo, PWA manifest, service worker
├── e2e/                    # Playwright end-to-end tests
├── infra/nginx/            # Nginx config + TLS certs
├── db/                     # DB seeds and migration scripts
├── .github/workflows/      # CI pipeline
├── docker-compose.yml
├── Makefile
├── .env.example
└── LICENSE                 # BUSL-1.1
```

---

## Testing

### Backend unit & integration tests

```bash
# Run all tests inside the container
docker compose exec backend python -m pytest tests/ -v

# Run a specific test module
docker compose exec backend python -m pytest tests/test_auth.py -v

# With coverage
docker compose exec backend python -m pytest tests/ --cov=app --cov-report=term-missing
```

Test modules:

| File | What it covers |
|---|---|
| `test_auth.py` | Login, token refresh, MFA, password change |
| `test_routers.py` | Core CRUD endpoints — studies, visits, questionnaires |
| `test_estudos_service.py` | Study service business logic |
| `test_state_machine.py` | Visit state transition rules |
| `test_tenant_isolation.py` | Cross-tenant data leakage prevention |
| `test_pii.py` | PII encryption/decryption + re-encryption |
| `test_antivirus.py` | ClamAV upload scanning |
| `test_fotos_mime.py` | MIME type detection for photo uploads |
| `test_nav_defaults.py` | Navigation defaults per role |

### End-to-end tests (Playwright)

```bash
cd e2e
npm install
npx playwright test
```

E2E specs: `auth.spec.ts` · `estudos.spec.ts` · `visitas.spec.ts`

### CI

GitHub Actions runs the backend test suite on every push to `main` and `develop` and on all pull requests. See [.github/workflows/ci.yml](.github/workflows/ci.yml).

---

## Deployment

### Production checklist

- [ ] Set `ENVIRONMENT=production` in `.env` (enables fatal startup checks)
- [ ] Generate a strong `JWT_SECRET`: `openssl rand -hex 64`
- [ ] Generate a unique `PII_KEY`: `python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`
- [ ] Change all `CHANGE_ME_*` values in `.env`
- [ ] Point `MINIO_ENDPOINT` to your MinIO instance
- [ ] Configure SMTP for email notifications
- [ ] Set up TLS certs in `infra/nginx/certs/` and enable HTTPS in `nginx.conf`
- [ ] Set `EDITION=pro` + `COGNIRA_LICENSE_KEY` (Pro features)
- [ ] Configure VAPID keys for push notifications (Pro)
- [ ] Configure coturn TURN server (Pro WebRTC)
- [ ] Set up automated backups (`pgbackup` service)
- [ ] Rotate the OpenAI API key from the demo environment

### TLS / HTTPS

Place your certificate and key in:

```
infra/nginx/certs/fullchain.pem
infra/nginx/certs/privkey.pem
```

Then uncomment the HTTPS server block in `infra/nginx/nginx.conf` and restart Nginx.

### Scaling

The backend is stateless and supports horizontal scaling. Run multiple `backend` replicas behind Nginx with:

```yaml
# docker-compose.yml
backend:
  deploy:
    replicas: 3
```

The frontend can be served as a static export (`npm run build && npm run export`) and served via Nginx/CDN for zero-cost static hosting.

---

## Security

### Measures in place

| Area | Implementation |
|---|---|
| **Auth** | Short-lived JWT (15 min) + 7-day refresh + token blacklist on logout |
| **MFA** | TOTP (Google Authenticator compatible) — optional per user |
| **PII encryption** | Fernet symmetric encryption on all personal data fields |
| **Password hashing** | bcrypt (passlib) |
| **Antivirus** | ClamAV scans every uploaded file before storage |
| **MIME validation** | Server-side MIME detection (python-magic), not trusted from client |
| **CORS** | Restricted to configured origins |
| **SQL injection** | SQLAlchemy ORM with parameterised queries throughout |
| **XSS** | DOMPurify on all user-generated HTML content (frontend) |
| **Tenant isolation** | All queries filter by `tenant_id` via `tenant_filter()` dependency |
| **Audit log** | Immutable `audit_log` table records all state-changing operations |
| **Webhook security** | HMAC-SHA256 signature on all outgoing webhook payloads |
| **API key hashing** | API keys stored as SHA-256 hashed values, never in plaintext |
| **File upload limits** | Configurable max file size via `max_ficheiro_mb` |

### Reporting a vulnerability

Please report security issues by email to [me@otokura.online](mailto:me@otokura.online). Do not open a public GitHub issue for security vulnerabilities.

---

## Licensing & Commercial Use

Cognira is released under the **Business Source License 1.1 (BUSL-1.1)**.

| Use case | Allowed? |
|---|---|
| Personal / hobby projects | ✅ Free |
| Academic research | ✅ Free |
| Non-profit organisations | ✅ Free |
| Internal tooling (not sold to customers) | ✅ Free |
| Running as a commercial SaaS / charging end-users | ❌ Requires licence |
| Embedding in a commercial product | ❌ Requires licence |

The licence automatically converts to **Apache-2.0** on **2030-01-01**.

See [LICENSE](LICENSE) for the full legal text.

**To obtain a commercial licence:** contact [me@otokura.online](mailto:me@otokura.online)

---

## Contributing

Community contributions are welcome for bug fixes and documentation improvements.

1. Fork the repository
2. Create a feature branch: `git checkout -b fix/your-fix`
3. Make changes and add tests
4. Run the test suite: `make test`
5. Open a pull request against `main`

For new features or significant changes, please open an issue first to discuss.

---

<p align="center">
  Built with ❤️ · <a href="mailto:me@otokura.online">me@otokura.online</a> · <a href="https://otokura.online">otokura.online</a>
</p>
