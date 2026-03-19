"""
Stripe billing integration.

Endpoints:
  POST /api/billing/checkout  — create Stripe Checkout Session → returns redirect URL
  POST /api/billing/portal    — create Stripe Customer Portal session → returns redirect URL
  GET  /api/billing/status    — current subscription info for the caller's tenant
  POST /api/billing/webhook   — Stripe webhook receiver (verifies signature)

Environment variables required (in .env):
  STRIPE_SECRET_KEY=sk_live_...
  STRIPE_WEBHOOK_SECRET=whsec_...
  STRIPE_PRICE_STARTER=price_...
  STRIPE_PRICE_PROFESSIONAL=price_...
  STRIPE_PRICE_ENTERPRISE=price_...
"""
import logging
from typing import Optional

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user
from app.models.tenant import Tenant
from app.models.user import Utilizador

router = APIRouter()
logger = logging.getLogger(__name__)

settings = get_settings()

# ── Stripe price ID lookup ────────────────────────────────────────────────────
# Maps plan code → env var name for the Stripe Price ID.
_PLAN_PRICE_MAP: dict[str, str] = {
    "starter":      settings.stripe_price_starter,
    "professional": settings.stripe_price_professional,
    "enterprise":   settings.stripe_price_enterprise,
}


def _require_stripe() -> None:
    if not settings.stripe_secret_key:
        raise HTTPException(503, "Stripe not configured on this instance.")
    stripe.api_key = settings.stripe_secret_key


def _price_id_for_plan(codigo: str) -> str:
    price_id = _PLAN_PRICE_MAP.get(codigo, "")
    if not price_id:
        raise HTTPException(
            422, f"Plano '{codigo}' não tem um Stripe Price ID configurado. "
                 "Defina STRIPE_PRICE_{STARTER|PROFESSIONAL|ENTERPRISE} no ambiente."
        )
    return price_id


# ── GET /api/billing/status ───────────────────────────────────────────────────

@router.get("/status")
async def billing_status(
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the current billing/subscription status for the caller's tenant."""
    if user.is_superadmin:
        raise HTTPException(400, "Superadmins não têm tenant billing.")

    tenant = (
        await db.execute(select(Tenant).where(Tenant.id == user.tenant_id))
    ).scalar_one_or_none()
    if not tenant:
        raise HTTPException(404, "Tenant não encontrado.")

    plano = tenant.plano  # loaded via selectin

    return {
        "tenant_status": tenant.status,
        "trial_ends_at": tenant.trial_ends_at,
        "plano": plano.nome if plano else None,
        "plano_codigo": plano.codigo if plano else None,
        "preco_mensal": float(plano.preco_mensal) if plano else None,
        "stripe_customer_id": tenant.stripe_customer_id,
        "stripe_subscription_id": tenant.stripe_subscription_id,
        "stripe_subscription_status": tenant.stripe_subscription_status,
        "stripe_configured": bool(settings.stripe_secret_key),
    }


# ── POST /api/billing/checkout ────────────────────────────────────────────────

class CheckoutRequest(BaseModel):
    plano_codigo: Optional[str] = None  # override plan (for upgrades); defaults to current plan
    success_path: str = "/tenant-admin?billing=success"
    cancel_path: str = "/tenant-admin?billing=cancelled"


@router.post("/checkout")
async def create_checkout_session(
    body: CheckoutRequest,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a Stripe Checkout Session for a subscription.
    Returns {url} — redirect the user there.
    """
    if user.role_global not in ("admin",) and not user.is_superadmin:
        raise HTTPException(403, "Apenas admins podem gerir a subscrição.")

    tenant = (
        await db.execute(select(Tenant).where(Tenant.id == user.tenant_id))
    ).scalar_one_or_none()
    if not tenant:
        raise HTTPException(404, "Tenant não encontrado.")

    plano = tenant.plano
    target_codigo = body.plano_codigo or (plano.codigo if plano else None)
    if not target_codigo or target_codigo in ("demo",):
        raise HTTPException(422, "Plano inválido para checkout.")

    price_id = _price_id_for_plan(target_codigo)
    _require_stripe()

    base = settings.frontend_url.rstrip("/")
    success_url = f"{base}{body.success_path}&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url  = f"{base}{body.cancel_path}"

    # Reuse customer if one already exists for this tenant
    customer_id = tenant.stripe_customer_id

    session_params: dict = {
        "mode": "subscription",
        "line_items": [{"price": price_id, "quantity": 1}],
        "success_url": success_url,
        "cancel_url": cancel_url,
        "metadata": {"tenant_id": str(tenant.id), "tenant_slug": tenant.slug},
        "subscription_data": {
            "metadata": {"tenant_id": str(tenant.id)},
        },
        "allow_promotion_codes": True,
    }
    if customer_id:
        session_params["customer"] = customer_id
    else:
        session_params["customer_email"] = tenant.owner_email

    try:
        session = stripe.checkout.Session.create(**session_params)
    except stripe.StripeError as exc:
        logger.error("Stripe checkout error for tenant %s: %s", tenant.id, exc)
        raise HTTPException(502, f"Erro Stripe: {exc.user_message or str(exc)}")

    return {"url": session.url, "session_id": session.id}


# ── POST /api/billing/portal ──────────────────────────────────────────────────

@router.post("/portal")
async def create_portal_session(
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a Stripe Customer Portal session (manage subscription, invoices, cancel).
    Returns {url} — redirect the user there.
    """
    if user.role_global not in ("admin",) and not user.is_superadmin:
        raise HTTPException(403, "Apenas admins podem gerir a subscrição.")

    tenant = (
        await db.execute(select(Tenant).where(Tenant.id == user.tenant_id))
    ).scalar_one_or_none()
    if not tenant or not tenant.stripe_customer_id:
        raise HTTPException(
            422, "Sem subscrição Stripe activa. Crie primeiro uma subscrição via checkout."
        )

    _require_stripe()
    base = settings.frontend_url.rstrip("/")
    return_url = f"{base}/tenant-admin"

    try:
        session = stripe.billing_portal.Session.create(
            customer=tenant.stripe_customer_id,
            return_url=return_url,
        )
    except stripe.StripeError as exc:
        logger.error("Stripe portal error for tenant %s: %s", tenant.id, exc)
        raise HTTPException(502, f"Erro Stripe: {exc.user_message or str(exc)}")

    return {"url": session.url}


# ── POST /api/billing/webhook ────────────────────────────────────────────────

@router.post("/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Stripe webhook endpoint. Verifies signature, handles subscription lifecycle.
    Set this URL in the Stripe Dashboard: https://<your-domain>/api/billing/webhook
    """
    if not settings.stripe_webhook_secret:
        raise HTTPException(503, "Webhook secret not configured.")

    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")

    stripe.api_key = settings.stripe_secret_key
    try:
        event = stripe.Webhook.construct_event(
            payload, sig, settings.stripe_webhook_secret
        )
    except stripe.SignatureVerificationError:
        raise HTTPException(400, "Invalid Stripe signature.")

    await _handle_stripe_event(event, db)
    return {"received": True}


async def _handle_stripe_event(event: stripe.Event, db: AsyncSession) -> None:
    """Dispatch Stripe event to the appropriate handler."""
    etype = event["type"]
    obj   = event["data"]["object"]
    logger.info("Stripe event: %s", etype)

    if etype == "checkout.session.completed":
        await _on_checkout_completed(obj, db)

    elif etype in ("customer.subscription.updated", "customer.subscription.created"):
        await _on_subscription_updated(obj, db)

    elif etype == "customer.subscription.deleted":
        await _on_subscription_deleted(obj, db)

    elif etype == "invoice.payment_succeeded":
        # Ensure tenant is active when payment succeeds (e.g. after dunning)
        sub_id = obj.get("subscription")
        if sub_id:
            await _set_tenant_status_by_sub(sub_id, "active", obj.get("status", "active"), db)

    elif etype == "invoice.payment_failed":
        # Grace period: Stripe handles retries; we log here but don't suspend immediately
        logger.warning("Payment failed for subscription: %s", obj.get("subscription"))

    else:
        logger.debug("Unhandled Stripe event type: %s", etype)


async def _on_checkout_completed(session: dict, db: AsyncSession) -> None:
    tenant_id = _get_tenant_id_from_metadata(session)
    if not tenant_id:
        return

    tenant = await _get_tenant(tenant_id, db)
    if not tenant:
        return

    customer_id = session.get("customer")
    subscription_id = session.get("subscription")

    tenant.stripe_customer_id = customer_id
    tenant.stripe_subscription_id = subscription_id
    tenant.stripe_subscription_status = "active"
    tenant.status = "active"
    await db.commit()
    logger.info("Tenant %d activated via checkout session %s", tenant_id, session.get("id"))


async def _on_subscription_updated(subscription: dict, db: AsyncSession) -> None:
    tenant_id = _get_tenant_id_from_metadata(subscription)
    sub_id = subscription.get("id")
    stripe_status = subscription.get("status", "")

    if not tenant_id:
        # Fall back to lookup by subscription ID
        if sub_id:
            await _set_tenant_status_by_sub(sub_id, _stripe_to_tenant_status(stripe_status), stripe_status, db)
        return

    tenant = await _get_tenant(tenant_id, db)
    if not tenant:
        return

    tenant.stripe_subscription_id = sub_id
    tenant.stripe_subscription_status = stripe_status
    tenant.status = _stripe_to_tenant_status(stripe_status)
    await db.commit()


async def _on_subscription_deleted(subscription: dict, db: AsyncSession) -> None:
    sub_id = subscription.get("id")
    tenant_id = _get_tenant_id_from_metadata(subscription)

    tenant = None
    if tenant_id:
        tenant = await _get_tenant(tenant_id, db)
    elif sub_id:
        tenant = (
            await db.execute(select(Tenant).where(Tenant.stripe_subscription_id == sub_id))
        ).scalar_one_or_none()

    if tenant:
        tenant.stripe_subscription_status = "canceled"
        tenant.status = "suspended"
        await db.commit()
        logger.info("Tenant %d suspended — subscription %s cancelled", tenant.id, sub_id)


async def _set_tenant_status_by_sub(
    sub_id: str, tenant_status: str, stripe_status: str, db: AsyncSession
) -> None:
    tenant = (
        await db.execute(select(Tenant).where(Tenant.stripe_subscription_id == sub_id))
    ).scalar_one_or_none()
    if tenant:
        tenant.stripe_subscription_status = stripe_status
        tenant.status = tenant_status
        await db.commit()


def _stripe_to_tenant_status(stripe_status: str) -> str:
    """Map Stripe subscription status to our tenant status."""
    mapping = {
        "active":             "active",
        "trialing":           "trial",
        "past_due":           "active",   # keep active during dunning
        "unpaid":             "suspended",
        "canceled":           "suspended",
        "incomplete":         "trial",
        "incomplete_expired": "suspended",
        "paused":             "suspended",
    }
    return mapping.get(stripe_status, "trial")


def _get_tenant_id_from_metadata(obj: dict) -> Optional[int]:
    meta = obj.get("metadata") or {}
    tid = meta.get("tenant_id")
    try:
        return int(tid) if tid else None
    except (ValueError, TypeError):
        return None


async def _get_tenant(tenant_id: int, db: AsyncSession) -> Optional[Tenant]:
    return (
        await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    ).scalar_one_or_none()
