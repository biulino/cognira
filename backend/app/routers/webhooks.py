"""
/api/webhooks — Webhook subscription management + API key management.

Endpoints:
  POST   /api/webhooks/api-keys          — create API key
  GET    /api/webhooks/api-keys          — list API keys for client
  DELETE /api/webhooks/api-keys/{id}     — revoke API key
  POST   /api/webhooks/subscriptions     — create webhook subscription
  GET    /api/webhooks/subscriptions     — list subscriptions
  PUT    /api/webhooks/subscriptions/{id} — update subscription
  DELETE /api/webhooks/subscriptions/{id} — delete subscription
  GET    /api/webhooks/deliveries/{sub_id} — delivery log
  GET    /api/webhooks/events            — list supported events
"""
import hashlib
import ipaddress
import secrets
import uuid
from typing import Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, HttpUrl
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession


_SSRF_BLOCKED_HOSTS = {"localhost", "metadata.google.internal", "169.254.169.254"}
_SSRF_BLOCKED_PREFIXES = ("192.168.", "10.", "172.16.", "172.17.", "172.18.", "172.19.",
                           "172.20.", "172.21.", "172.22.", "172.23.", "172.24.",
                           "172.25.", "172.26.", "172.27.", "172.28.", "172.29.",
                           "172.30.", "172.31.")


def _validate_webhook_url(url: str) -> None:
    """Raise HTTPException 400 if the URL targets a private/loopback address (SSRF guard)."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="Webhook URL must use http or https.")
    host = (parsed.hostname or "").lower()
    if not host:
        raise HTTPException(status_code=400, detail="Webhook URL has no hostname.")
    if host in _SSRF_BLOCKED_HOSTS:
        raise HTTPException(status_code=400, detail="Webhook URL not allowed.")
    if any(host.startswith(p) for p in _SSRF_BLOCKED_PREFIXES):
        raise HTTPException(status_code=400, detail="Webhook URL not allowed.")
    try:
        addr = ipaddress.ip_address(host)
        if addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_reserved:
            raise HTTPException(status_code=400, detail="Webhook URL not allowed.")
    except ValueError:
        pass  # hostname, not a raw IP — allow

from app.database import get_db
from app.deps import get_current_user, require_role, tenant_filter
from app.models.client import Cliente
from app.models.user import Utilizador
from app.models.webhook import ApiKey, WebhookSubscription, WebhookDelivery
from app.services.webhooks import EVENTS

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────

class ApiKeyCreate(BaseModel):
    nome: str
    cliente_id: int
    scopes: list[str] = ["read"]
    rate_limit_rpm: int = 60


class WebhookCreate(BaseModel):
    cliente_id: int
    url: str
    eventos: list[str]

    def validate_url(self) -> None:
        _validate_webhook_url(self.url)


class WebhookUpdate(BaseModel):
    url: Optional[str] = None
    eventos: Optional[list[str]] = None
    activo: Optional[bool] = None


# ── API Keys ─────────────────────────────────────────────

@router.post("/api-keys", dependencies=[Depends(require_role("admin", "coordenador"))], status_code=201)
async def create_api_key(
    body: ApiKeyCreate,
    user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    """Generate a new API key for a client. Returns the raw key ONCE."""
    tid = tenant_filter(user)
    if tid is not None:
        cliente = (
            await db.execute(
                select(Cliente).where(Cliente.id == body.cliente_id, Cliente.tenant_id == tid)
            )
        ).scalar_one_or_none()
        if not cliente:
            raise HTTPException(404, "Cliente não encontrado")
    raw_key = f"em_{secrets.token_urlsafe(32)}"
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    key_prefix = raw_key[:12]

    api_key = ApiKey(
        id=uuid.uuid4(),
        cliente_id=body.cliente_id,
        nome=body.nome,
        key_hash=key_hash,
        key_prefix=key_prefix,
        scopes=body.scopes,
        rate_limit_rpm=body.rate_limit_rpm,
    )
    db.add(api_key)
    await db.flush()

    return {
        "id": str(api_key.id),
        "nome": api_key.nome,
        "key": raw_key,  # Only shown once
        "prefix": key_prefix,
        "scopes": api_key.scopes,
        "rate_limit_rpm": api_key.rate_limit_rpm,
    }


@router.get("/api-keys", dependencies=[Depends(require_role("admin", "coordenador"))])
async def list_api_keys(
    cliente_id: Optional[int] = None,
    user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    q = select(ApiKey).join(Cliente, Cliente.id == ApiKey.cliente_id)
    tid = tenant_filter(user)
    if tid is not None:
        q = q.where(Cliente.tenant_id == tid)
    if cliente_id:
        q = q.where(ApiKey.cliente_id == cliente_id)
    q = q.order_by(ApiKey.criado_em.desc())
    rows = (await db.execute(q)).scalars().all()
    return [
        {
            "id": str(k.id),
            "cliente_id": k.cliente_id,
            "nome": k.nome,
            "prefix": k.key_prefix,
            "scopes": k.scopes,
            "rate_limit_rpm": k.rate_limit_rpm,
            "activo": k.activo,
            "ultimo_uso": k.ultimo_uso.isoformat() if k.ultimo_uso else None,
            "criado_em": k.criado_em.isoformat() if k.criado_em else None,
        }
        for k in rows
    ]


@router.delete("/api-keys/{key_id}", dependencies=[Depends(require_role("admin"))], status_code=204)
async def revoke_api_key(
    key_id: uuid.UUID,
    user: Utilizador = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    tid = tenant_filter(user)
    if tid is not None:
        key_row = (
            await db.execute(
                select(ApiKey)
                .join(Cliente, Cliente.id == ApiKey.cliente_id)
                .where(ApiKey.id == key_id, Cliente.tenant_id == tid)
            )
        ).scalar_one_or_none()
        if not key_row:
            raise HTTPException(404, "API key não encontrada")
        await db.delete(key_row)
        await db.commit()
        return
    result = await db.execute(delete(ApiKey).where(ApiKey.id == key_id).returning(ApiKey.id))
    if not result.fetchone():
        raise HTTPException(404, "API key não encontrada")


# ── Webhook Subscriptions ────────────────────────────────

@router.get("/events")
async def list_events(_: Utilizador = Depends(get_current_user)):
    return {"events": EVENTS}


@router.post("/subscriptions", dependencies=[Depends(require_role("admin", "coordenador"))], status_code=201)
async def create_subscription(
    body: WebhookCreate,
    user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    _validate_webhook_url(body.url)
    tid = tenant_filter(user)
    if tid is not None:
        cliente = (
            await db.execute(
                select(Cliente).where(Cliente.id == body.cliente_id, Cliente.tenant_id == tid)
            )
        ).scalar_one_or_none()
        if not cliente:
            raise HTTPException(404, "Cliente não encontrado")
    invalid = [e for e in body.eventos if e not in EVENTS]
    if invalid:
        raise HTTPException(422, f"Eventos inválidos: {invalid}")

    sub = WebhookSubscription(
        id=uuid.uuid4(),
        cliente_id=body.cliente_id,
        url=body.url,
        eventos=body.eventos,
        secret=secrets.token_urlsafe(32),
    )
    db.add(sub)
    await db.flush()

    return {
        "id": str(sub.id),
        "url": sub.url,
        "eventos": sub.eventos,
        "secret": sub.secret,  # Shown once
        "activo": True,
    }


@router.get("/subscriptions", dependencies=[Depends(require_role("admin", "coordenador"))])
async def list_subscriptions(
    cliente_id: Optional[int] = None,
    user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    q = select(WebhookSubscription).join(Cliente, Cliente.id == WebhookSubscription.cliente_id)
    tid = tenant_filter(user)
    if tid is not None:
        q = q.where(Cliente.tenant_id == tid)
    if cliente_id:
        q = q.where(WebhookSubscription.cliente_id == cliente_id)
    q = q.order_by(WebhookSubscription.criado_em.desc())
    rows = (await db.execute(q)).scalars().all()
    return [
        {
            "id": str(s.id),
            "cliente_id": s.cliente_id,
            "url": s.url,
            "eventos": s.eventos,
            "activo": s.activo,
            "falhas_consecutivas": s.falhas_consecutivas,
            "criado_em": s.criado_em.isoformat() if s.criado_em else None,
        }
        for s in rows
    ]


@router.put("/subscriptions/{sub_id}", dependencies=[Depends(require_role("admin", "coordenador"))])
async def update_subscription(
    sub_id: uuid.UUID,
    body: WebhookUpdate,
    user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    sub = await _get_subscription_or_404(db, sub_id, user)

    if body.url is not None:
        _validate_webhook_url(body.url)
        sub.url = body.url
    if body.eventos is not None:
        invalid = [e for e in body.eventos if e not in EVENTS]
        if invalid:
            raise HTTPException(422, f"Eventos inválidos: {invalid}")
        sub.eventos = body.eventos
    if body.activo is not None:
        sub.activo = body.activo
        if body.activo:
            sub.falhas_consecutivas = 0

    return {"status": "ok"}


@router.delete("/subscriptions/{sub_id}", dependencies=[Depends(require_role("admin"))], status_code=204)
async def delete_subscription(
    sub_id: uuid.UUID,
    user: Utilizador = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    sub = await _get_subscription_or_404(db, sub_id, user)
    await db.delete(sub)
    await db.commit()


@router.get("/deliveries/{sub_id}", dependencies=[Depends(require_role("admin", "coordenador"))])
async def list_deliveries(
    sub_id: uuid.UUID,
    limit: int = 50,
    user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    # Verify subscription belongs to user's tenant
    await _get_subscription_or_404(db, sub_id, user)
    rows = (
        await db.execute(
            select(WebhookDelivery)
            .where(WebhookDelivery.subscription_id == sub_id)
            .order_by(WebhookDelivery.criado_em.desc())
            .limit(min(limit, 200))
        )
    ).scalars().all()
    return [
        {
            "id": str(d.id),
            "evento": d.evento,
            "status_code": d.status_code,
            "erro": d.erro,
            "tentativa": d.tentativa,
            "criado_em": d.criado_em.isoformat() if d.criado_em else None,
        }
        for d in rows
    ]


async def _get_subscription_or_404(
    db: AsyncSession,
    sub_id: uuid.UUID,
    user: Utilizador,
) -> WebhookSubscription:
    stmt = select(WebhookSubscription).where(WebhookSubscription.id == sub_id)
    tid = tenant_filter(user)
    if tid is not None:
        stmt = (
            stmt
            .join(Cliente, Cliente.id == WebhookSubscription.cliente_id)
            .where(Cliente.tenant_id == tid)
        )
    sub = (await db.execute(stmt)).scalar_one_or_none()
    if not sub:
        raise HTTPException(404, "Subscrição não encontrada")
    return sub
