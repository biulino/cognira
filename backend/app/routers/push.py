"""Web Push subscription endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user
from app.models.push import PushSubscription
from app.models.user import Utilizador

router = APIRouter()


class SubscribeBody(BaseModel):
    endpoint: str
    p256dh: str
    auth: str


@router.get("/public-key")
async def get_public_key():
    """Return VAPID public key so the frontend can subscribe."""
    settings = get_settings()
    if not settings.vapid_public_key:
        raise HTTPException(503, "Push notifications not configured")
    return {"public_key": settings.vapid_public_key}


@router.post("/subscribe", status_code=204)
async def subscribe(
    body: SubscribeBody,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register or refresh a push subscription for the current user."""
    existing = (
        await db.execute(
            select(PushSubscription).where(
                PushSubscription.endpoint == body.endpoint
            )
        )
    ).scalar_one_or_none()

    if existing:
        existing.utilizador_id = user.id
        existing.p256dh = body.p256dh
        existing.auth = body.auth
    else:
        db.add(
            PushSubscription(
                utilizador_id=user.id,
                endpoint=body.endpoint,
                p256dh=body.p256dh,
                auth=body.auth,
            )
        )
    await db.commit()


@router.delete("/subscribe", status_code=204)
async def unsubscribe(
    body: SubscribeBody,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a push subscription."""
    await db.execute(
        delete(PushSubscription).where(
            PushSubscription.endpoint == body.endpoint,
            PushSubscription.utilizador_id == user.id,
        )
    )
    await db.commit()
