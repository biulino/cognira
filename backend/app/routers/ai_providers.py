"""
/api/ai-providers — Multi-provider AI configuration store.

GET  /api/ai-providers                  — full config with masked keys (superadmin only)
PUT  /api/ai-providers                  — saves full config (superadmin only)
GET  /api/ai-providers/pool             — providers list WITHOUT keys (any tenant admin)
GET  /api/ai-providers/routing          — task→provider routing map (any auth user, for AI modules)
GET  /api/ai-providers/tenant-routing   — tenant's own routing overrides (tenant admin)
PUT  /api/ai-providers/tenant-routing   — save tenant routing overrides (tenant admin)
"""
import json
import re
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.settings import ConfiguracaoSistema
from app.models.user import Utilizador

router = APIRouter()

CONFIG_KEY = "ai_providers"

# ── Default config (returned when not yet configured) ─────────────────────────
DEFAULT_CONFIG: dict[str, Any] = {
    "providers": [],
    "routing": {
        "chat": None,
        "transcription": None,
        "embeddings": None,
        "vision": None,
        "scoring": None,
    },
}

_MASK = "••••••••"
_MASK_RE = re.compile(r"^\•+$")


def _mask_provider(p: dict) -> dict:
    """Return a copy of a provider dict with the api_key masked."""
    out = dict(p)
    if out.get("api_key") and not _MASK_RE.match(str(out["api_key"])):
        out["api_key"] = _MASK
    return out


def _merge_keys(existing_providers: list, new_providers: list) -> list:
    """
    When saving, if the api_key in the new payload is the mask string,
    preserve the original stored key instead of overwriting with '••••••••'.
    """
    existing_map = {p["id"]: p for p in existing_providers if p.get("id")}
    result = []
    for np in new_providers:
        pid = np.get("id")
        if pid and _MASK_RE.match(str(np.get("api_key", ""))):
            # Key unchanged — restore original
            orig = existing_map.get(pid, {})
            np = dict(np)
            np["api_key"] = orig.get("api_key", "")
        result.append(np)
    return result


async def _read_config(db: AsyncSession) -> dict:
    row = (
        await db.execute(
            select(ConfiguracaoSistema).where(ConfiguracaoSistema.chave == CONFIG_KEY)
        )
    ).scalar_one_or_none()
    if not row:
        return DEFAULT_CONFIG
    try:
        return json.loads(row.valor)
    except Exception:
        return DEFAULT_CONFIG


TENANT_ROUTING_KEY_PREFIX = "ai_tenant_routing"

TASKS = ("chat", "transcription", "embeddings", "vision", "scoring")
EMPTY_ROUTING: dict[str, Any] = {t: None for t in TASKS}


def _safe_provider(p: dict) -> dict:
    """Return a provider dict safe for tenant-admin consumption (no api_key)."""
    return {
        "id": p.get("id"),
        "name": p.get("name"),
        "type": p.get("type"),
        "base_url": p.get("base_url"),
        "enabled": p.get("enabled", True),
        "models": p.get("models", {}),
    }


async def _read_tenant_routing(db: AsyncSession, tenant_id: int | None) -> dict:
    if tenant_id is None:
        return dict(EMPTY_ROUTING)
    key = f"{TENANT_ROUTING_KEY_PREFIX}:{tenant_id}"
    row = (
        await db.execute(
            select(ConfiguracaoSistema).where(ConfiguracaoSistema.chave == key)
        )
    ).scalar_one_or_none()
    if not row:
        return dict(EMPTY_ROUTING)
    try:
        return json.loads(row.valor)
    except Exception:
        return dict(EMPTY_ROUTING)


class AIProviderConfig(BaseModel):
    providers: list[dict]
    routing: dict[str, Any]


@router.get("")
async def get_ai_providers(
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user.is_superadmin:
        raise HTTPException(status_code=403, detail="Acesso restrito a superadmins.")
    cfg = await _read_config(db)
    cfg = dict(cfg)
    cfg["providers"] = [_mask_provider(p) for p in cfg.get("providers", [])]
    return cfg


@router.put("")
async def set_ai_providers(
    body: AIProviderConfig,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user.is_superadmin:
        raise HTTPException(status_code=403, detail="Acesso restrito a superadmins.")

    # Preserve existing keys when mask is sent back
    existing = await _read_config(db)
    providers = _merge_keys(existing.get("providers", []), body.providers)

    new_cfg = {
        "providers": providers,
        "routing": body.routing,
    }
    valor_str = json.dumps(new_cfg, ensure_ascii=False)

    row = (
        await db.execute(
            select(ConfiguracaoSistema).where(ConfiguracaoSistema.chave == CONFIG_KEY)
        )
    ).scalar_one_or_none()

    if row:
        row.valor = valor_str
        row.atualizado_em = datetime.now(timezone.utc)
    else:
        row = ConfiguracaoSistema(
            chave=CONFIG_KEY,
            valor=valor_str,
            descricao="Configuração de fornecedores de IA multi-provider",
            atualizado_em=datetime.now(timezone.utc),
        )
        db.add(row)

    await db.commit()
    # Invalidate provider factory cache so routing changes take immediate effect
    from app.ai.provider_factory import invalidate_cache
    invalidate_cache()
    # Return masked version
    new_cfg["providers"] = [_mask_provider(p) for p in new_cfg["providers"]]
    return new_cfg


@router.get("/routing")
async def get_routing(
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns only the task→provider routing map (no API keys). Used by AI modules."""
    cfg = await _read_config(db)
    providers_map = {
        p["id"]: {"name": p.get("name"), "base_url": p.get("base_url"), "api_key": p.get("api_key", ""), "models": p.get("models", {})}
        for p in cfg.get("providers", [])
        if p.get("enabled", True)
    }
    return {
        "routing": cfg.get("routing", DEFAULT_CONFIG["routing"]),
        "providers": providers_map,
    }


@router.get("/pool")
async def get_provider_pool(
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns enabled providers WITHOUT api_keys. Safe for tenant-admin routing UI."""
    if user.role_global != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores.")
    cfg = await _read_config(db)
    providers = [
        _safe_provider(p)
        for p in cfg.get("providers", [])
        if p.get("enabled", True)
    ]
    return {"providers": providers}


class TenantRoutingConfig(BaseModel):
    routing: dict[str, Any]


@router.get("/tenant-routing")
async def get_tenant_routing(
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns this tenant's routing overrides. Tenant admin only."""
    if user.role_global != "admin" or user.is_superadmin:
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores de tenant.")
    routing = await _read_tenant_routing(db, user.tenant_id)
    return {"routing": routing}


@router.put("/tenant-routing")
async def set_tenant_routing(
    body: TenantRoutingConfig,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Saves tenant routing overrides. Tenant admin only, no access to API keys."""
    if user.role_global != "admin" or user.is_superadmin:
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores de tenant.")
    if user.tenant_id is None:
        raise HTTPException(status_code=400, detail="Utilizador não associado a nenhum tenant.")

    # Only allow valid task keys; discard anything else
    routing = {t: body.routing.get(t) for t in TASKS}

    key = f"{TENANT_ROUTING_KEY_PREFIX}:{user.tenant_id}"
    valor_str = json.dumps(routing, ensure_ascii=False)

    row = (
        await db.execute(
            select(ConfiguracaoSistema).where(ConfiguracaoSistema.chave == key)
        )
    ).scalar_one_or_none()

    if row:
        row.valor = valor_str
        row.atualizado_em = datetime.now(timezone.utc)
    else:
        row = ConfiguracaoSistema(
            chave=key,
            valor=valor_str,
            descricao=f"Routing IA override do tenant {user.tenant_id}",
            atualizado_em=datetime.now(timezone.utc),
        )
        db.add(row)

    await db.commit()
    return {"routing": routing}
