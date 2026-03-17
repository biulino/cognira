"""AI Provider Factory — resolves the correct AsyncOpenAI client for a given task.

Reads routing configuration stored by /api/ai-providers in configuracoes_sistema.

Supported tasks: 'chat' | 'transcription' | 'embeddings' | 'vision' | 'scoring'

Falls back to OPENAI_API_KEY env var when:
  - No provider config exists in DB
  - No provider is routed for the requested task
  - The routed provider has no api_key stored

Supports any OpenAI-compatible provider via base_url (LM Studio, Ollama, Azure, etc.).
"""
from __future__ import annotations

import json
import time
from typing import Optional, Tuple

from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings

settings = get_settings()

# ── Simple in-memory cache (avoids a DB round-trip on every single AI call) ──
_cache: dict = {}
_cache_ts: float = 0.0
_CACHE_TTL: float = 60.0  # seconds — re-read DB at most once per minute


async def _load_config(db: AsyncSession) -> dict:
    """Load AI provider config from DB, with TTL-based in-memory cache."""
    global _cache, _cache_ts
    now = time.monotonic()
    if _cache and (now - _cache_ts) < _CACHE_TTL:
        return _cache

    from app.models.settings import ConfiguracaoSistema  # local to avoid circular

    row = (
        await db.execute(
            select(ConfiguracaoSistema).where(ConfiguracaoSistema.chave == "ai_providers")
        )
    ).scalar_one_or_none()

    if not row:
        return {}
    try:
        cfg = json.loads(row.valor)
        _cache = cfg
        _cache_ts = now
        return cfg
    except Exception:
        return {}


async def get_client_for_task(
    task: str,
    db: AsyncSession,
) -> Tuple[Optional[AsyncOpenAI], Optional[str]]:
    """Return (client, model_name) for the given task.

    model_name is the model override stored in the provider config (e.g. 'gpt-4.1').
    Returns (None, None) only when no API key is available at all.
    Callers should treat None client as "AI not configured".
    """
    cfg = await _load_config(db)

    routing: dict = cfg.get("routing", {})
    providers: dict = {
        p["id"]: p
        for p in cfg.get("providers", [])
        if p.get("enabled", True) and p.get("id")
    }

    provider_id = routing.get(task)
    provider = providers.get(provider_id) if provider_id else None

    if provider and provider.get("api_key"):
        client = AsyncOpenAI(
            api_key=provider["api_key"],
            base_url=provider.get("base_url") or None,
        )
        model: Optional[str] = provider.get("models", {}).get(task) or None
        return client, model

    # Fallback to environment key (default Cognira-managed OpenAI account)
    if settings.openai_api_key:
        return AsyncOpenAI(api_key=settings.openai_api_key), None

    return None, None


def invalidate_cache() -> None:
    """Force the factory to reload config from DB on the next call.

    Call this after PUT /ai-providers to ensure new routing is picked up
    without waiting for the TTL to expire.
    """
    global _cache_ts
    _cache_ts = 0.0
