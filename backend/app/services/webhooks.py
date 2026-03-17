"""
Webhook delivery service.

Fire-and-forget: dispatches POST to subscriber URLs with HMAC signature.
"""
import hashlib
import hmac
import json
import uuid
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.webhook import WebhookSubscription, WebhookDelivery

# Supported events — subscribers filter on these
EVENTS = [
    "visita.criada",
    "visita.estado_mudou",
    "visita.concluida",
    "alerta.score_baixo",
    "estudo.criado",
    "analista.atribuido",
]

_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=10.0, follow_redirects=False)
    return _client


def _sign_payload(payload_bytes: bytes, secret: str) -> str:
    return hmac.new(secret.encode(), payload_bytes, hashlib.sha256).hexdigest()


async def dispatch_event(db: AsyncSession, evento: str, payload: dict) -> int:
    """Send event to all active subscribers listening for this event type.

    Returns number of deliveries attempted.
    """
    subs = (
        await db.execute(
            select(WebhookSubscription).where(
                WebhookSubscription.activo.is_(True),
            )
        )
    ).scalars().all()

    # Filter subscriptions that listen for this event
    matching = [s for s in subs if evento in (s.eventos or [])]
    if not matching:
        return 0

    client = _get_client()
    count = 0

    for sub in matching:
        delivery_id = uuid.uuid4()
        payload_with_meta = {
            "evento": evento,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": payload,
        }
        body = json.dumps(payload_with_meta, default=str).encode()
        signature = _sign_payload(body, sub.secret)

        status_code = None
        resposta = None
        erro = None

        try:
            resp = await client.post(
                str(sub.url),
                content=body,
                headers={
                    "Content-Type": "application/json",
                    "X-Webhook-Signature": f"sha256={signature}",
                    "X-Webhook-Event": evento,
                    "X-Webhook-Delivery": str(delivery_id),
                },
            )
            status_code = resp.status_code
            resposta = resp.text[:1000] if resp.text else None

            if resp.is_success:
                sub.falhas_consecutivas = 0
            else:
                sub.falhas_consecutivas = (sub.falhas_consecutivas or 0) + 1
        except Exception as exc:
            erro = str(exc)[:1000]
            sub.falhas_consecutivas = (sub.falhas_consecutivas or 0) + 1

        # Auto-disable after 10 consecutive failures
        if (sub.falhas_consecutivas or 0) >= 10:
            sub.activo = False

        delivery = WebhookDelivery(
            id=delivery_id,
            subscription_id=sub.id,
            evento=evento,
            payload=payload_with_meta,
            status_code=status_code,
            resposta=resposta,
            erro=erro,
        )
        db.add(delivery)
        count += 1

    return count
