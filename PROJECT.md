# Estudos de Mercado — Q21 Intelligence Platform
> Documento de estado do projecto. Última actualização: 2026-03-12.
> **Wave 7 concluída:** AI Study Wizard (wizard multi-step, Q21 AI suggestion engine, one-click study creation).
> **Wave 6 concluída:** Chat Interno completo com chamadas de voz WebRTC P2P (TURN/coturn), grupos. Sistema de Planos & Módulos granulares por cliente (8 planos, 22 módulos) com UI de gestão.
> **Wave 5 concluída:** Shelf Audit (auditoria de lineares, scan EAN/QR, conformidade, GPS check-in, AI analysis).
> Actualiza este ficheiro sempre que completares ou adicionares algo.

---

## Índice
1. [Stack e Arquitectura](#1-stack-e-arquitectura)
2. [Como Correr](#2-como-correr)
3. [Credenciais Demo](#3-credenciais-demo)
4. [Planos & Módulos](#4-planos--módulos)
5. [Estrutura de Ficheiros](#5-estrutura-de-ficheiros)
6. [Backend — Modelos e Endpoints](#6-backend--modelos-e-endpoints)
7. [Frontend — Páginas](#7-frontend--páginas)
8. [Q21 Intelligence™ — Módulos de IA](#8-q21-intelligence--módulos-de-ia)
9. [Dados Demo](#9-dados-demo)
10. [Próximos Passos — Wave 8](#10-próximos-passos--wave-8)

---

## 1. Stack e Arquitectura

```
Internet → Nginx (port 8088) → Next.js 14  (frontend)
                             → FastAPI      (backend /api/*)
                             → PostgreSQL 16 + pgvector (DB)
                             → MinIO         (fotos/ficheiros S3-compatible)
                             → ClamAV        (scan antivírus de uploads)
                             → Coturn        (TURN server para WebRTC P2P calls)
```

| Componente | Tecnologia | Container |
|---|---|---|
| Frontend | Next.js 14 + React 18 + Tailwind CSS + TypeScript | `frontend` |
| Backend API | Python 3.12 + FastAPI + SQLAlchemy 2.0 async | `backend` |
| Base de Dados | PostgreSQL 16 + pgcrypto + pgvector | `postgres` |
| Object Storage | MinIO (S3 compatible) | `minio` |
| Virus Scanner | ClamAV | `clamav` |
| Reverse Proxy | Nginx 1.27 | `nginx` |
| TURN Server | Coturn | `coturn` |

**IA:** Q21 AI (text-to-SQL, chat semântico, planeamento, score preditivo, anomalias, validação IA, wizard, relatório narrativo, insights semanais, call center, shelf audit) · Q21 AI STT (Call Center) · Q21 AI Embeddings (RAG)
**Auth:** JWT (15min access + 7 dias refresh) + TOTP (MFA opcional) + **SSO/OIDC** (Authentik/Keycloak/Azure AD/Google)
**RBAC:** 6 roles — `admin`, `coordenador`, `validador`, `analista`, `cliente`, `utilizador`
**i18n:** PT/EN/ES/FR via React Context nativo (sem dependências extra); locale persistida em localStorage
**WebRTC:** chamadas de voz P2P via `useWebRTC.ts` hook + coturn TURN server; sinalização via WebSocket relay em `ws.py`

---

## 2. Como Correr

```bash
# Na pasta /home/biulas/DOCKER/estudos-mercado

# Iniciar tudo
docker compose up -d

# Ver logs
docker compose logs -f backend

# Parar tudo
docker compose down

# Recriar dados demo (APAGA tudo e recria)
docker compose exec backend python -m app.seed

# Rebuild de um serviço
docker compose build backend && docker compose up -d backend
docker compose up --build --force-recreate -d frontend

# Correr testes
docker compose exec backend python -m pytest tests/ -v
```

**URLs:**
- Frontend: http://65.108.45.58:8088
- API Swagger: http://65.108.45.58:8088/api/docs
- MinIO Console: http://65.108.45.58:9001 (minioadmin / Minio2024Secret!)
- Apresentação B2B: http://65.108.45.58:8088/landing.html
- Landing pública: http://65.108.45.58:8088/home.html

---

## 3. Credenciais Demo

| Username | Password | Role | Acesso |
|---|---|---|---|
| `admin` | `AdminSeguro2026!` | admin | Tudo |
| `coordenador` | `CoordSeguro2026!` | coordenador | Todos os estudos |
| `validador` | `ValidSeguro2026!` | validador | Todos os estudos |
| `analista1` | `AnalistaDemo2026!` | analista | Visitas do analista |
| `cliente_vodafone` | `ClienteVF2026!` | utilizador/cliente | Estudos Vodafone |
| `cliente_nos` | `ClienteNOS2026!` | utilizador/cliente | Estudos NOS |
| `cliente_mcd` | `ClienteMCD2026!` | utilizador/cliente | Estudos McDonald's |
| `cliente_galp` | `ClienteGALP2026!` | utilizador/cliente | Estudos Galp |
| `cliente_fnac` | `ClienteFNAC2026!` | utilizador/cliente | Estudos FNAC |

---

## 4. Planos & Módulos

O sistema permite activar/desactivar funcionalidades por cliente de forma granular. 8 planos agrupam 22 módulos. Gerido em `/planos` (admin only).

| Plano | Cor | Módulos |
|-------|-----|---------|
| **Mystery Shopping** | blue | `estudos`, `visitas`, `analistas`, `multi_grid`, `mapa`, `relatorios` |
| **Call Center** | orange | `callcenter` |
| **Shelf Audit** | emerald | `shelf_audit`, `barcode` |
| **Sondagens & Questionários** | violet | `questionarios`, `survey_portal` |
| **Q21 Intelligence™** | rose | `chat_ia`, `alertas`, `sla`, `benchmarking`, `fraude`, `rag` |
| **Formações** | amber | `formacoes` |
| **Pagamentos** | teal | `pagamentos` |
| **Comunicação** | sky | `mensagens`, `chat_interno`, `push` |

Endpoints:
- `GET /api/clientes/{id}/modulos` — retorna catálogo + flags activas
- `PUT /api/clientes/{id}/modulos` — salva flags `{key: bool}` (idempotente)

---

## 5. Estrutura de Ficheiros

```
estudos-mercado/
├── docker-compose.yml            ✅ 7 serviços (+ coturn)
├── Makefile                      ✅ atalhos (make up, make seed, etc.)
├── PROJECT.md                    ✅ este ficheiro
├── ROADMAP.md                    ✅ wave tracking
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/env.py            ✅ async migrations
│   └── alembic/versions/
│       ├── 001_callcenter.py     ✅
│       ├── 002_mensagens.py      ✅
│       ├── 003_ia_visita.py      ✅
│       ├── 004_configuracoes.py  ✅
│       ├── 005_chat_interno.py   ✅
│       ├── 006_foto_ia.py        ✅
│       ├── 007_candidatura_pii.py ✅
│       ├── 008_chat_sessoes.py   ✅
│       ├── 009_formacoes.py      ✅
│       ├── 010_estabelecimento_geo.py ✅
│       ├── 011_sso_id.py         ✅
│       ├── 012_push_subscriptions.py  ✅
│       ├── 013_rag_embeddings.py  ✅ pgvector vector(1536)
│       ├── 014_submetido_em.py   ✅ String→DateTime migration
│       ├── 015_fase7_webhooks_apikeys.py ✅
│       ├── 016_multi_grid.py     ✅
│       ├── 017_shelf_audit.py    ✅
│       ├── 018_planos_modulos.py ✅
│       └── 019_shelf_ia_analise.py ✅
│   └── app/
│       ├── main.py               ✅ FastAPI app + CORS + 25+ routers
│       ├── config.py             ✅ pydantic Settings
│       ├── database.py           ✅ async engine + session
│       ├── deps.py               ✅ get_db, get_current_user, require_role
│       ├── ws.py                 ✅ WebSocket ConnectionManager + WebRTC relay
│       ├── seed.py               ✅ dados demo completos
│       ├── models/               ✅ 20+ ficheiros, 50+ tabelas
│       ├── routers/              ✅ 25+ routers, 100+ endpoints
│       ├── services/
│       │   ├── state_machine.py  ✅ 12 estados das visitas
│       │   ├── audit.py          ✅ registo de auditoria
│       │   ├── storage.py        ✅ MinIO helper centralizado
│       │   ├── pii.py            ✅ Fernet PII encrypt/decrypt
│       │   └── callcenter_pipeline.py ✅ Q21 AI STT → Q21 AI → PDF
│       ├── auth/                 ✅ JWT + TOTP
│       ├── ai/
│       │   ├── agent.py          ✅ text-to-SQL + Function Calling
│       │   └── intelligence.py   ✅ Q21 Intelligence™ (14+ módulos)
│       └── ingest/
│           └── csv_parser.py     ✅ import CSV de visitas
│
├── frontend/
│   └── src/
│       ├── lib/
│       │   ├── api.ts            ✅ axios client com refresh + globalToast
│       │   ├── i18n.tsx          ✅ React Context i18n PT/EN/ES/FR
│       │   └── globalToast.ts    ✅ singleton de toasts
│       ├── hooks/
│       │   ├── useWebRTC.ts      ✅ P2P voice calls (offer/answer/ICE/TURN)
│       │   └── useOfflineDraft.ts ✅ IndexedDB offline drafts
│       ├── locales/              ✅ pt.json, en.json, es.json, fr.json
│       └── app/                  ✅ 40+ páginas (ver secção 7)
│
├── db/seeds/init.sql             ✅ extensão pgcrypto + pgvector
└── infra/nginx/nginx.conf        ✅ rate limiting + security headers
```

---

## 6. Backend — Modelos e Endpoints

### Migrations (19 ficheiros versionados)

001 call center → 002 mensagens → 003 ia_visita → 004 config → 005 chat_interno → 006 foto_ia → 007 candidatura_pii → 008 chat_sessoes → 009 formacoes → 010 estabelecimento_geo → 011 sso_id → 012 push → 013 rag_embeddings (pgvector) → 014 submetido_em (DateTime) → 015 webhooks_apikeys → 016 multi_grid → 017 shelf_audit → 018 planos_modulos → 019 shelf_ia_analise

### Modelos (50+ tabelas)

| Ficheiro | Tabelas | Notas |
|---|---|---|
| `user.py` | `utilizadores`, `permissoes_estudo` | UUID PK, role_global + permissões por estudo, sso_id |
| `client.py` | `clientes` | Empresa cliente |
| `study.py` | `estudos`, `ondas`, `filtros_estudo` | tipo_caracterizacao JSONB |
| `analyst.py` | `analistas`, `candidaturas_recrutamento`, `chilling_periods`, `blacklist_estabelecimentos`, `certificacoes_analista` | PII Fernet encriptado |
| `establishment.py` | `estabelecimentos` | lat/lng para TSP routing |
| `visit.py` | `visitas`, `campos_visita`, `caracterizacao_cache`, `candidaturas_visita` | 12 estados |
| `evaluation.py` | `grelhas`, `criterios`, `respostas` | Multi-grid por tipo de visita |
| `photo.py` | `fotos_visita` | MinIO + ClamAV scan + IA verdict |
| `payment.py` | `tabelas_valores`, `pagamentos_visita`, `orcamentos_estudo` | |
| `message.py` | `mensagens_visita` | Comentários por visita |
| `training.py` | `formacoes`, `formacoes_analista` | E-learning + certificações |
| `compliance.py` | `gdpr_consents`, `data_requests`, `audit_log` | RGPD + auditoria |
| `callcenter.py` | `templates_callcenter`, `chamadas_callcenter`, `configuracao_callcenter` | Q21 AI STT + Q21 AI pipeline |
| `chat.py` | `conversas`, `conversa_membros`, `chat_mensagens` | Chat real-time + WebRTC |
| `questionnaire.py` | `questionarios`, `perguntas`, `respostas_questionario` | Builder dinâmico |
| `settings.py` | `configuracoes_plataforma` | Singleton de configurações + alertas_score |
| `push.py` | `push_subscriptions` | Web Push VAPID |
| `webhook.py` | `api_keys`, `webhooks`, `webhook_deliveries` | HMAC-SHA256 |
| `shelf_audit.py` | `shelf_audit_items`, `shelf_ia_analise` | Auditoria de lineares |
| `modulo.py` | `clientes_modulos` | Planos & Módulos; CATALOGO_PLANOS (8 planos, 22 módulos) |

### Routers e Endpoints principais

| Router | Prefixo | Endpoints-chave |
|---|---|---|
| `auth` | `/auth` | POST login, 2fa/verify, 2fa/setup, refresh, logout, GET /me, POST change-password, SSO |
| `estudos` | `/estudos` | CRUD, ondas, campos, relatorio PDF, insights, Q21 planear-ia, benchmarking |
| `visitas` | `/visitas` | CRUD, 12 estados, stats, timeline, export Excel, fraude, SLA, criterios-score |
| `visitas` (barcode) | `/visitas` | GET /barcode?code= lookup produto por EAN |
| `fotos` | `/visitas/{id}/fotos` | POST upload+ClamAV, GET, DELETE, POST analisar (Q21 AI Vision) |
| `analistas` | `/analistas` | CRUD, chilling-periods, blacklist, anomalias, score-preditivo |
| `clientes` | `/clientes` | CRUD, GET/PUT /{id}/modulos (Planos & Módulos) |
| `estabelecimentos` | `/estabelecimentos` | CRUD, geo scores, route-optimize (TSP 2-opt) |
| `utilizadores` | `/utilizadores` | CRUD completo, permissões por estudo |
| `pagamentos` | `/pagamentos` | CRUD, aprovar, relatorio analistas/detalhe |
| `chat` | `/chat` | POST chat (Function Calling IA) |
| `callcenter` | `/callcenter` | upload, GET list/detail, audio-url presigned, análise, retranscrever, PDF |
| `chat_interno` | `/chat-interno` | GET/POST conversas, mensagens, PUT ler, GET nao-lidas, GET utilizadores |
| `questionarios` | `/questionarios` | CRUD questionários, perguntas, submissão pública HMAC |
| `mensagens` | `/mensagens` | inbox-style mensagens, nao-lidas count |
| `configuracoes` | `/configuracoes` | GET/PUT singleton config |
| `callcenter_admin` | `/callcenter` | GET/PUT/POST templates, GET/PUT configuracao |
| `rag` | `/rag` | POST ingest (embed+store), POST search (cosine), GET/DELETE documentos |
| `alertas` | `/alertas` | GET score, GET/PUT config threshold |
| `audit` | `/audit` | GET audit_log paginado |
| `webhooks` | `/webhooks` | CRUD api_keys, webhooks, GET deliveries |
| `shelf_audit` | `/shelf-audit` | CRUD itens, GET summary, POST analisar-ia, GET export |
| `push` | `/push` | POST subscribe, POST send |
| `portal` | `/portal` | GET stats, GET resumo-ia, GET mapa |
| `wizard` | `/wizard` | POST sugestao (Q21 AI), POST aplicar |
| `ws` | `/ws` | WebSocket (chat real-time + WebRTC signal relay) |
| `sso` | `/auth/sso` | GET config, GET login, GET callback |

### Segurança

- ✅ JWT com refresh token rotation (15min + 7 dias)
- ✅ TOTP MFA (Google Authenticator) — secrets encriptados com Fernet
- ✅ RBAC por role global + permissões por estudo em todos os endpoints
- ✅ Rate limiting no Nginx (10r/s geral, 5r/s login)
- ✅ Nginx security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
- ✅ ClamAV scan obrigatório em todos os uploads (fotos, CSV)
- ✅ Chat IA: só SELECT permitido; confirmação antes de DML
- ✅ Audit log completo de todas as acções
- ✅ PII analistas encriptado (Fernet AES-128-CBC + HMAC-SHA256)
- ✅ Emails de utilizadores encriptados com Fernet
- ✅ TOTP secrets e backup codes encriptados com Fernet
- ✅ CORS restrito ao frontend_url configurado
- ✅ WebRTC: TURN credentials geradas on-demand com expiração (coturn HMAC)
- ✅ HMAC-SHA256 em signatures de webhooks e QR survey tokens
- ✅ Startup validation — bloqueia arranque com JWT_SECRET=CHANGE_ME ou PII_KEY default

### Máquina de Estados das Visitas (12 estados)

```
nova → planeada → inserida → corrigir → corrigida → validada → fechada
                           ↘ corrigir_email → corrigida
                           ↘ para_alteracao → inserida
                           ↘ situacao_especial → inserida
                           ↘ sem_alteracoes → inserida
                           ↘ anulada
```

---

## 7. Frontend — Páginas

| Página | Rota | Estado | O que faz |
|---|---|---|---|
| Login | `/login` | ✅ | Login + 2FA TOTP; botão SSO condicional |
| SSO Callback | `/sso-callback` | ✅ | Lê tokens do URL fragment após OIDC |
| Dashboard | `/dashboard` | ✅ | Stats reais, pie chart por estado, LineChart 30d |
| Estudos | `/estudos` | ✅ | Lista estudos com estado e datas |
| Detalhe Estudo | `/estudos/[id]` | ✅ | KPIs, ondas, visitas recentes, Relatório IA, Insights IA, Planear IA |
| Campos Estudo | `/estudos/[id]/campos` | ✅ | Configurar campos por estudo (chave, label, tipo, reordenar) |
| Analistas | `/analistas` | ✅ | CRUD + Q21 Anomalias (±2σ) + Score Preditivo por analista |
| Visitas | `/visitas` | ✅ | Tabela enriquecida, 7 filtros, paginação, mudança de estado, fotos modal |
| Estabelecimentos | `/estabelecimentos` | ✅ | Lista + editar; RBAC admin/coordenador para create/delete |
| Pagamentos | `/pagamentos` | ✅ | Lista + aprovar + relatório analistas |
| Clientes | `/clientes` | ✅ | Lista + criar/editar/activar-desactivar |
| Utilizadores | `/utilizadores` | ✅ | CRUD completo + permissões por estudo |
| Chat IA | `/chat` | ✅ | Text-to-SQL; Function Calling; chips sugestões Q21 |
| **Chat Interno** | `/chat-interno` | ✅ | Real-time; grupos; chamadas de voz WebRTC P2P (TURN/coturn); badge não-lidas |
| Call Center | `/callcenter` | ✅ | Lista chamadas, upload modal, filtros, paginação |
| Call Center Detalhe | `/callcenter/[id]` | ✅ | Polling, player áudio, tabs transcrição/dados/relatório, PDF |
| Call Center Admin | `/callcenter/admin` | ✅ | Templates dinâmicos + configuração global |
| Questionários | `/questionarios` | ✅ | Builder visual NPS/CSAT/Escala + QR surveys HMAC |
| QR Codes | `/qrcodes` | ✅ | Gestão de QR surveys; pré-visualização e exportação |
| Survey público | `/survey/[id]/[token]` | ✅ | Formulário público sem login; validação HMAC |
| Ingest CSV | `/ingest` | ✅ | Upload + preview + confirmar + ClamAV scan |
| Mensagens | `/mensagens` | ✅ | Caixa entrada/enviadas; badge não-lidas |
| Configurações | `/configuracoes` | ✅ | Painel admin configurações globais |
| Relatórios | `/relatorios` | ✅ | KPIs, distribuição estados, drill-down por critério, exports |
| SLA Monitor | `/sla` | ✅ | Visitas em atraso por estado, KPI cards, threshold |
| Mapa | `/mapa` | ✅ | react-leaflet; heatmap por score; otimização rota TSP 2-opt |
| Fraude | `/fraude` | ✅ | Heurísticas: intervalo suspeito, fotos duplicadas, scores perfeitos; severidade |
| Benchmarking | `/benchmarking` | ✅ | KPIs cross-cliente; masking para coordenadores |
| Pesquisa RAG | `/pesquisa` | ✅ | Tabs: pesquisa semântica / documentos / ingest; pgvector |
| Alertas | `/alertas` | ✅ | Score abaixo do threshold; slider config; KPI cards |
| Barcode | `/barcode` | ✅ | BarcodeDetector API + fallback manual; historial de leituras |
| **Shelf Audit** | `/shelf-audit` | ✅ | Auditoria de lineares; scan EAN; conformidade; AI analysis; export |
| Formações | `/formacoes` | ✅ | Gestão de formações e certificações de analistas |
| **Planos & Módulos** | `/planos` | ✅ | Gestão granular de módulos por cliente; toggle por plano ou módulo individual |
| **AI Study Wizard** | `/wizard` | ✅ | 4-step wizard; AI suggestion (Q21 AI); review/edit draft; one-click create |
| Webhooks | `/webhooks` | ✅ | Gestão de API Keys + webhooks; histórico de deliveries |
| Audit Log | `/audit` | ✅ | Histórico paginado de operações por estudo/utilizador |
| Portal Cliente | `/portal` | ✅ | Dashboard cliente: KPIs, resumo IA, trend 30d |
| Portal Mapa | `/portal/mapa` | ✅ | Mapa de rotas do cliente |
| Intro | `/intro` | ✅ | Landing page on-app (sem autenticação) |
| Docs | `/docs/*` | ✅ | Docs por role: admin, coordenador, validador, analista, cliente; funcionalidades; IA |

**Componentes globais:**
- ✅ AppShell com sidebar dinâmica (menu por role + module gating)
- ✅ API client (`api.ts`) com refresh automático + globalToast singleton
- ✅ ChatBubble flutuante (balão de chat interno; badge não-lidas; polling 3s)
- ✅ i18n React Context — PT/EN/ES/FR; LocaleSwitcher no sidebar
- ✅ PWA: manifest, service worker (stale-while-revalidate + offline.html)
- ✅ Push Notifications: Web Push API + VAPID + `SwRegister.tsx`
- ✅ `useWebRTC.ts` hook: states idle/calling/receiving/connecting/active/ended; SDP offer/answer; ICE queuing; TURN credentials; mute/timer
- ✅ `useOfflineDraft.ts` hook: IndexedDB rascunhos de visitas offline

---

## 8. Q21 Intelligence™ — Módulos de IA

| Módulo | Endpoint/Onde | Descrição |
|---|---|---|
| 1 — Relatório Narrativo | `POST /estudos/{id}/relatorio-ia` | Relatório executivo em linguagem natural + top/bottom lojas + recomendações |
| 3 — Fotos IA | `POST /visitas/{id}/fotos/{fid}/analisar` | Q21 AI Vision — veredicto, confiança, motivo por foto |
| 4 — Planeamento Auto | `POST /estudos/{id}/ondas/{oid}/planear-ia` | Distribui estabs por analistas equilibrando carga + score; TSP routing |
| 5 — Insights Semanais | `GET /estudos/{id}/insights` | Análise últimos 30 dias vs período anterior; próximas 3 acções |
| 6 — Chat Logística | `POST /chat` | Reatribuição de visitas por linguagem natural + preview + confirmação |
| 7 — Chat Semântico | `POST /chat` | Text-to-SQL com sugestões proactivas de follow-up |
| 8 — Score Preditivo | `GET /analistas/{id}/score-preditivo` | Tendência + intervalo de confiança + factores explicativos |
| Anomalias | `GET /analistas/anomalias` | Detecção desvios ≥2σ (score suspeito alto ou baixo) |
| Validação IA | Botão no modal de visita | Recomendação aprovar/corrigir/rever + motivos detalhados |
| Call Center IA | `POST /callcenter/upload` | Q21 AI STT → Q21 AI extração → relatório narrativo → PDF |
| Word Cloud | `POST /estudos/{id}/word-cloud` | Temas dominantes das observações de campo |
| Comparativo Temporal | `POST /estudos/{id}/comparativo` | Análise entre dois períodos + narrativa |
| Sentimento IA | `POST /estudos/{id}/sentimento` | Score emocional por loja/região (positivo/neutro/negativo) |
| Auto-QC | `POST /visitas/{id}/qc` | Flags de qualidade: consistência, completude, coerência |
| Coaching IA | `GET /analistas/{id}/coaching` | Plano de desenvolvimento individual por analista |
| Shelf Audit IA | `POST /shelf-audit/{id}/analisar-ia` | Análise de conformidade de lineares + recomendações |
| Wizard IA | `POST /wizard/sugestao` | Gera campos, critérios, pesos e módulos por sector/briefing |
| RAG | `POST /rag/ingest`, `POST /rag/search` | Embeddings + pgvector cosine similarity para pesquisa de briefings |
| Resumo Executivo | `GET /portal/resumo-ia/{id}` | Q21 AI; resumo em 3 bullets para portal do cliente |

---

## 9. Dados Demo

Criados pelo `backend/app/seed.py`:

| Entidade | Quantidade | Detalhes |
|---|---|---|
| Utilizadores | 9 | admin, coordenador, validador, analista1, clientes (5) |
| Clientes | 5 | Vodafone, NOS, McDonald's, Galp, FNAC |
| Analistas | 15 | PII encriptado com Fernet |
| Estudos | 5 | Um por cliente |
| Estabelecimentos | 51 | Com coordenadas geográficas |
| Visitas | 188 | Todos os 12 estados representados |
| Fotos | 355 | Associadas a visitas |
| Pagamentos | 103 | Para visitas validadas/fechadas |
| Módulos activos | 22/22 | Todos os módulos activos em todos os clientes demo |

---

## 10. Próximos Passos — Wave 8

| # | Feature | Prioridade | Descrição |
|---|---------|-----------|-----------|
| 8.1 | PWA offline robusto | Alta | IndexedDB persistente para visitas offline com mais de 24h; background sync com conflict resolution |
| 8.2 | Capacitor wrapper | Alta | App nativa iOS/Android via Capacitor; push nativas; câmara nativa; distribuição stores |
| 8.3 | GPS tracking | Média | Background geolocation durante visita; trail recording; prova de presença verificada |
| 8.4 | Planogram compliance | Alta | Upload de planogram ideal + Photo AI compare vs foto real; score compliance |
| 8.5 | Relatórios multi-idioma | Média | PDF export no locale do utilizador/cliente; dashboards localizados |
| 8.6 | Multi-tenant SaaS | Alta | Onboarding self-service por cliente; billing; isolamento de dados |
| 8.7 | API pública Zapier/n8n | Média | Webhooks bidirecionais; conectores Salesforce/HubSpot/Pipedrive |
| 8.8 | SLA contractual | Média | SLA por cliente com penalidades automáticas; dashboard de cumprimento |

---

## Comandos Úteis

```bash
# Ver todos os containers
docker compose ps

# Logs em tempo real
docker compose logs -f

# Entrar na base de dados
docker compose exec postgres psql -U emercado estudos_mercado

# Contar visitas por estado
docker compose exec postgres psql -U emercado estudos_mercado -c "SELECT estado, count(*) FROM visitas GROUP BY estado ORDER BY count DESC;"

# Reiniciar só o backend
docker compose build backend && docker compose up -d backend

# Reiniciar só o frontend (força rebuild)
docker compose up --build --force-recreate -d frontend

# Correr todos os testes
docker compose exec backend python -m pytest tests/ -v --tb=short

# Seed standalone Call Center (não apaga dados)
docker compose exec backend python -m app.seed_callcenter

# Aplicar migrations pendentes
docker compose exec backend alembic upgrade head
```
