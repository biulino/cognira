from contextlib import asynccontextmanager
import os
import subprocess
import sys
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings


# Dev-default PII key — used only to detect misconfiguration, never as a real key
_DEFAULT_PII_KEY = "CHANGE_ME_generate_with_fernet"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Security checks ──────────────────────────────────
    _settings = get_settings()
    _is_prod = os.getenv("ENVIRONMENT", "development").lower() in ("production", "prod")
    if _settings.jwt_secret == "CHANGE_ME":
        msg = "JWT_SECRET is set to the default value 'CHANGE_ME'"
        if _is_prod:
            raise RuntimeError(f"FATAL: {msg}. Set a strong secret via JWT_SECRET env var.")
        print(f"[security] WARNING: {msg}. Change it before deploying.", flush=True)
    if _settings.pii_key == _DEFAULT_PII_KEY:
        msg = "PII_KEY is using the dev default"
        if _is_prod:
            raise RuntimeError(f"FATAL: {msg}. Generate one with: python3 -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\"")
        print(f"[security] WARNING: {msg}. Change it before deploying.", flush=True)
    if _settings.license_signing_key == "cognira-dev-signing-key":
        msg = "LICENSE_SIGNING_KEY is using the public dev default — anyone with the source code can forge a Pro licence"
        if _is_prod:
            raise RuntimeError(f"FATAL: {msg}. Set a unique secret via LICENSE_SIGNING_KEY env var.")
        print(f"[security] WARNING: {msg}. Set LICENSE_SIGNING_KEY before deploying Pro.", flush=True)
    # Sentry error tracking (no-op if SENTRY_DSN is not set)
    if _settings.sentry_dsn:
        try:
            import sentry_sdk
            sentry_sdk.init(dsn=_settings.sentry_dsn, traces_sample_rate=0.05)
            print("[sentry] Error tracking enabled.", flush=True)
        except ImportError:
            print("[sentry] sentry-sdk not installed — skipping.", flush=True)
    # Run DB migrations on startup
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd="/app",
        env={**__import__("os").environ, "PYTHONPATH": "/app"},
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"[alembic] WARNING: {result.stderr}", flush=True)
    else:
        print(f"[alembic] {result.stdout.strip() or 'DB up to date'}", flush=True)
    startup_check()
    yield
    # shutdown


settings = get_settings()

_is_prod = os.getenv("ENVIRONMENT", "development").lower() in ("production", "prod")

app = FastAPI(
    title="Cognira",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None if _is_prod else "/api/docs",
    openapi_url=None if _is_prod else "/api/openapi.json",
    redirect_slashes=False,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── routers ──────────────────────────────────────────────
from app.routers import auth, estudos, visitas, analistas, clientes  # noqa: E402
from app.routers import estabelecimentos, pagamentos, chat, ingest, utilizadores  # noqa: E402
from app.routers import callcenter, fotos, mensagens  # noqa: E402
from app.routers import configuracoes  # noqa: E402
from app.routers import chat_interno  # noqa: E402
from app.routers import formacoes  # noqa: E402
from app.routers import questionarios  # noqa: E402
from app.routers import push  # noqa: E402
from app.routers import portal_cliente  # noqa: E402
from app.routers import rag  # noqa: E402
from app.routers import alertas  # noqa: E402
from app.routers import webhooks  # noqa: E402
from app.routers import public_survey  # noqa: E402
from app.routers import audit  # noqa: E402
from app.routers import shelf_audit  # noqa: E402
from app.routers import clientes_modulos  # noqa: E402
from app.routers import wizard  # noqa: E402
from app.routers import planograma  # noqa: E402
from app.routers import branding  # noqa: E402
from app.routers import superadmin  # noqa: E402
from app.routers import onboarding  # noqa: E402
from app.routers import billing  # noqa: E402
from app.routers import ai_providers  # noqa: E402
from app.routers import saml  # noqa: E402
from app.routers import external  # noqa: E402
from app.routers import status as status_router  # noqa: E402
from app.ws import websocket_endpoint, ws_router  # noqa: E402

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(saml.router, prefix="/api/auth/saml", tags=["saml"])
app.include_router(estudos.router, prefix="/api/estudos", tags=["estudos"])
app.include_router(visitas.router, prefix="/api/visitas", tags=["visitas"])
app.include_router(fotos.router, prefix="/api/visitas", tags=["fotos"])
app.include_router(analistas.router, prefix="/api/analistas", tags=["analistas"])
app.include_router(clientes.router, prefix="/api/clientes", tags=["clientes"])
app.include_router(clientes_modulos.router, prefix="/api/clientes", tags=["clientes-modulos"])
app.include_router(estabelecimentos.router, prefix="/api/estabelecimentos", tags=["estabelecimentos"])
app.include_router(pagamentos.router, prefix="/api/pagamentos", tags=["pagamentos"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(ingest.router, prefix="/api/ingest", tags=["ingest"])
app.include_router(utilizadores.router, prefix="/api/utilizadores", tags=["utilizadores"])
app.include_router(callcenter.router, prefix="/api/callcenter", tags=["callcenter"])
app.include_router(mensagens.router, prefix="/api/mensagens", tags=["mensagens"])
app.include_router(configuracoes.router, prefix="/api/configuracoes", tags=["configuracoes"])
app.include_router(chat_interno.router, prefix="/api/chat-interno", tags=["chat-interno"])
app.include_router(formacoes.router, prefix="/api/formacoes", tags=["formacoes"])
app.include_router(questionarios.router, prefix="/api/questionarios", tags=["questionarios"])
app.include_router(push.router, prefix="/api/push", tags=["push"])
app.include_router(portal_cliente.router, prefix="/api/portal", tags=["portal"])
app.include_router(rag.router, prefix="/api/rag", tags=["rag"])
app.include_router(alertas.router, prefix="/api/alertas", tags=["alertas"])
app.include_router(webhooks.router, prefix="/api/webhooks", tags=["webhooks"])
app.include_router(public_survey.router, prefix="/api/public/survey", tags=["public"])
app.include_router(audit.router, prefix="/api/audit", tags=["audit"])
app.include_router(shelf_audit.router, prefix="/api/shelf-audit", tags=["shelf-audit"])
app.include_router(wizard.router, prefix="/api/wizard", tags=["wizard"])
app.include_router(planograma.router, prefix="/api/planogramas", tags=["planograma"])
app.include_router(branding.router, prefix="/api/branding", tags=["branding"])
app.include_router(superadmin.router, prefix="/api/superadmin", tags=["superadmin"])
app.include_router(onboarding.router, prefix="/api/onboarding", tags=["onboarding"])
app.include_router(billing.router, prefix="/api/billing", tags=["billing"])
app.include_router(ai_providers.router, prefix="/api/ai-providers", tags=["ai-providers"])
app.include_router(external.router, prefix="/api", tags=["external-api"])
app.include_router(status_router.router, prefix="/api", tags=["status"])
app.include_router(ws_router, prefix="/api")
app.add_api_websocket_route("/api/ws", websocket_endpoint)


# ── Edition endpoint (public, no auth) ────────────────────────────────────────
from app.edition import edition_info, startup_check  # noqa: E402


@app.get("/api/edition", tags=["edition"])
async def get_edition_info():
    """Returns current edition (community/pro) and feature availability."""
    return edition_info()


# ── Public white-label theme endpoint (no auth required) ──────────────────────
from fastapi import Request  # noqa: E402
from app.database import get_db as _get_db  # noqa: E402

@app.get("/api/theme")
async def get_theme(request: Request):
    """Return CSS theme variables for the current hostname (white-label)."""
    from sqlalchemy import or_, select as _select
    from app.models.client import PortalCliente
    from app.services import storage

    hostname = request.headers.get("x-forwarded-host") or request.headers.get("host", "")
    hostname = hostname.split(":")[0].lower()  # strip port

    async for db in _get_db():
        portal = (await db.execute(
            _select(PortalCliente).where(
                PortalCliente.activo.is_(True),
                or_(
                    PortalCliente.dominio_custom == hostname,
                    PortalCliente.subdominio == hostname.split(".")[0],
                ),
            )
        )).scalar_one_or_none()

        if not portal:
            return {
                "cor_primaria": "#1E40AF",
                "cor_secundaria": "#3B82F6",
                "nome_marca": "Cognira Intelligence",
                "logo_url": None,
                "favicon_url": None,
                "css_custom": None,
            }

        logo_url = None
        if portal.logo_url_minio:
            try:
                logo_url = storage.presigned_get_url("fotos-visita", portal.logo_url_minio, expires_seconds=86400)
            except Exception:
                pass

        return {
            "cor_primaria": portal.cor_primaria,
            "cor_secundaria": portal.cor_secundaria,
            "nome_marca": portal.nome_marca,
            "logo_url": logo_url,
            "favicon_url": portal.favicon_url,
            "css_custom": portal.css_custom,
        }


@app.get("/health")
async def health():
    return {"status": "ok"}
