"""Web Push notification service (VAPID / pywebpush)."""
from __future__ import annotations

import json
import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.push import PushSubscription

logger = logging.getLogger(__name__)


async def send_push(
    user_id: UUID | str,
    title: str,
    body: str,
    url: str = "/",
    db: AsyncSession | None = None,
) -> None:
    """Send a Web Push notification to all subscriptions belonging to *user_id*.

    Silently ignored if VAPID keys are not configured or pywebpush is absent.
    """
    settings = get_settings()
    if not settings.vapid_private_key or not settings.vapid_public_key:
        return

    try:
        from pywebpush import webpush, WebPushException  # type: ignore[import-untyped]
    except ImportError:
        logger.debug("pywebpush not installed – push skipped")
        return

    if db is None:
        return

    subs = (
        await db.execute(
            select(PushSubscription).where(
                PushSubscription.utilizador_id == user_id
            )
        )
    ).scalars().all()

    payload = json.dumps({"title": title, "body": body, "url": url})

    for sub in subs:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                },
                data=payload,
                vapid_private_key=settings.vapid_private_key,
                vapid_claims={"sub": settings.vapid_email},
            )
        except WebPushException as exc:
            status = exc.response.status_code if exc.response else None
            if status in (404, 410):
                # Subscription expired or unregistered — remove it
                await db.delete(sub)
                await db.commit()
            else:
                logger.warning("Push failed for sub %s: %s", sub.id, exc)
        except Exception as exc:  # pragma: no cover
            logger.warning("Push error for sub %s: %s", sub.id, exc)
