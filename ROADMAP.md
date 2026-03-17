# Q21 Intelligence — Roadmap

> Última actualização: 2026-03-12
> Fases 1–8 (Waves 1–5): concluídas. Wave 6 (Comunicação & Planos): concluída. Wave 7 (AI Study Wizard): concluída.

---

## Fases Concluídas (resumo)

| Fase | Tema | Estado |
|------|------|--------|
| 1 | Core — Modelos, CRUD, Auth, Seed | ✅ |
| 2 | Validação, Questionários, Fotos, Chat | ✅ |
| 3 | IA (9 módulos Q21 Intelligence™), PII, Fotos IA | ✅ |
| 4 | Dashboard Cliente, Portal, Push, WebSockets | ✅ |
| 5 | Enterprise — SSO/OIDC, PWA, Fraude, Benchmarking | ✅ |
| 6 | Hardening — ClamAV, N+1, 68 testes, RBAC, RAG | ✅ |
| 7 | Mobile & Automação — PWA offline, TSP routing, API Keys/Webhooks, White-label | ✅ |
| 8 — Wave 1 | Quick wins: Word Cloud, Sentiment, Comparativo Temporal, Auto-QC, Coaching IA, QR Surveys, Audit Log | ✅ |
| 8 — Wave 2 | Survey builder visual, NPS/CSAT/Escala, Distribuição por email (SMTP) | ✅ |
| 8 — Wave 3 | Heatmap geográfico, SLA Monitor, Drill-down por critério, RAG Pesquisa Semântica, Alertas | ✅ |
| 8 — Wave 4 | Multi-Grelha de Avaliação multi-canal, score breakdown, AI agent multi-grelha, portal B2C por tipo | ✅ |
| **8C — i18n** | Framework i18n (PT/EN/ES/FR), LocaleSwitcher, locale detection, locales completas | ✅ |
| **8B.1** | Barcode Scanner (BarcodeDetector API + manual), página /barcode, wired ao nav | ✅ |
| **Wave 5 — Retail Audit** | ShelfAudit model + migration, CRUD API, frontend com scanner integrado, AI analysis (compliance rate, OOS, price deviations), GPS check-in com distância ao estabelecimento | ✅ |
| **Wave 6 — Comunicação & Planos** | Chat Interno com WebRTC (chamadas de voz P2P, TURN/coturn), grupos, mensagens em tempo real; Planos & Módulos catalog UI com gestão por cliente; AppShell atualizado; module gating completo | ✅ |

---

## Wave 7 — AI Study Wizard *(concluída)*

Objectivo: permitir que empresas configurem estudos completos (campos, grelhas, módulos) através de um wizard guiado por IA, partindo de objectivos de negócio em linguagem natural.

| Feature | Estado | Notas |
|---------|--------|-------|
| Wizard UI multi-step | ✅ | `/wizard` — briefing, sector, KPIs pretendidos; 4 passos com stepper visual |
| AI suggestion engine | ✅ | `POST /api/wizard/sugestao` — Q21 AI gera campos, critérios, pesos e módulos sugeridos por sector |
| Review & edit step | ✅ | Draft editável: campos de caracterização, secções de grelha e módulos togglables antes de aplicar |
| One-click apply | ✅ | `POST /api/wizard/aplicar` — cria estudo + campos + grelha + activa módulos do cliente num único request |
| Módulos context-aware | ✅ | Sugestões diferenciadas por sector: Retalho → shelf_audit/barcode, Banca → callcenter/rag, etc. |
| Integração AppShell | ✅ | Item "🧙 Wizard" no menu de navegação para admin/coordenador |

---

## Wave 8 — Native Mobile & SaaS Scale *(em progresso)*

| # | Feature | Descrição | Esforço | Estado |
|---|---------|-----------|---------|--------|
| 8.1 | PWA offline completo | IndexedDB para visitas/fotos offline persistente; background sync robusto; conflict resolution UI | Alto | ✅ |
| 8.2 | Capacitor wrapper | React Native wrapper; push nativas iOS; câmara nativa; distribuição App Store/Google Play | Alto | ⬜ |
| 8.3 | GPS tracking contínuo | Background geolocation durante visita; trail recording; prova de presença verificada | Médio | ✅ |
| 8.4 | Planogram compliance | Upload de planogram ideal + Q21 AI Vision compare vs foto real; score compliance + items corretos/errados/faltando + recomendações | Alto | ✅ |
| 8.5 | Relatórios multi-idioma | PDF export e dashboards no locale do utilizador/cliente (PT/EN/ES/FR) | Médio | ✅ |
| 8.6 | Multi-tenant SaaS self-service | Onboarding autónomo por cliente; billing integrado; isolamento de dados por tenant | Alto | ⬜ |
| 8.7 | API pública + Zapier/n8n | Webhooks bidirecionais, action triggers, conectores prontos para Salesforce/HubSpot/Pipedrive | Médio | ✅ |
| 8.8 | SLA contractual | SLA por cliente com thresholds configuráveis (visita/validação); dashboard com alertas e configuração por cliente | Médio | ✅ |
| 8.9 | Questionários multi-idioma | Traduções por campo/locale (EN/ES/FR); tab Traduções no builder; endpoint `GET ?locale=` serve questionário no idioma pedido | Médio | ✅ |

---

## Posicionamento Competitivo

### Q21 vs Checker — Resumo

| Dimensão | Checker | Q21 | Vencedor |
|----------|---------|-----|----------|
| AI profundidade | 5 features básicas (bolted-on) | 9 módulos nativos (preditivo, anomalias, planeamento, foto AI, RAG, shelf audit AI) | **Q21** |
| Mystery Shopping workflow | 15+ anos, muito maduro | Completo, menos mature | Checker |
| Survey distribution | Email/SMS/WhatsApp/QR/Kiosk | Email/QR/Portal público (Wave 8) | Checker |
| Retail audit | Módulo dedicado | ShelfAudit completo + AI + GPS check-in | **Empate** |
| Mobile app | Nativa Android/iOS + offline | PWA (Wave 8 expande) | Checker |
| Multi-language | 60+ países | PT/EN/ES/FR (framework i18n completa) | Checker |
| Segurança | ISO 27001 checkbox | OWASP, 2FA, PII encryption, ClamAV, rate limiting | **Q21** |
| Call center AI | Dialer + recorder básico | Transcrição Q21 AI + análise Q21 AI + PDF export | **Q21** |
| Preço/modelo | Enterprise SaaS caro (demo obrigatória) | Self-hosted / private cloud (flexível) | **Q21** |
| RAG/Knowledge | Keyword extraction | pgvector embeddings + semantic search | **Q21** |
| Comunicação interna | Email básico | Chat Interno com WebRTC P2P + grupos + push | **Q21** |
| Module management | Planos fixos | Planos & Módulos granulares por cliente | **Q21** |
| Study setup | Manual | Wave 7: AI Study Wizard (briefing → estudo completo) | **Q21** |

### Mensagem-chave
> *"Checker é um ERP de mystery shopping com AI colada por cima. Q21 é uma plataforma de inteligência com mystery shopping integrado."*
