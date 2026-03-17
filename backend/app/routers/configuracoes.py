"""
/api/configuracoes — admin-configurable platform settings (key-value JSON store).

GET  /api/configuracoes/{chave}       — any authenticated user (public read)
PUT  /api/configuracoes/{chave}       — admin only
GET  /api/configuracoes/nav/defaults  — returns hardcoded nav defaults (for UI)
"""
import json
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
from app.nav_defaults import NAV_DEFAULTS

router = APIRouter()

# Keys that are safe to expose without authentication (used on public-facing pages)
_PUBLIC_KEYS = {"signup_enabled", "app_name"}


class ConfigSet(BaseModel):
    valor: Any
    descricao: str | None = None


@router.get("/public/{chave}")
async def get_configuracao_public(
    chave: str,
    db: AsyncSession = Depends(get_db),
):
    """Unauthenticated read for safe public keys (e.g. signup_enabled).
    Only a whitelist of keys is allowed — all others return 404.
    """
    if chave not in _PUBLIC_KEYS:
        raise HTTPException(status_code=404, detail="Chave não disponível publicamente")
    row = (
        await db.execute(select(ConfiguracaoSistema).where(ConfiguracaoSistema.chave == chave))
    ).scalar_one_or_none()
    if not row:
        defaults = {"signup_enabled": True, "app_name": "Cognira"}
        return {"chave": chave, "valor": defaults.get(chave), "atualizado_em": None}
    try:
        valor_parsed = json.loads(row.valor)
    except Exception:
        valor_parsed = row.valor
    return {"chave": row.chave, "valor": valor_parsed, "atualizado_em": row.atualizado_em}


@router.get("/nav/defaults")
async def get_nav_defaults(user: Utilizador = Depends(get_current_user)):
    """Return hardcoded nav default layout (used by admin UI as baseline)."""
    return NAV_DEFAULTS


@router.get("/{chave}")
async def get_configuracao(
    chave: str,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # nav_permissoes is tenant-scoped: non-superadmins get their tenant's config
    # first, falling back to the global default.
    if chave == "nav_permissoes" and user.tenant_id and not user.is_superadmin:
        tenant_chave = f"nav_permissoes_{user.tenant_id}"
        tenant_row = (
            await db.execute(
                select(ConfiguracaoSistema).where(ConfiguracaoSistema.chave == tenant_chave)
            )
        ).scalar_one_or_none()
        if tenant_row:
            try:
                valor_parsed = json.loads(tenant_row.valor)
            except Exception:
                valor_parsed = tenant_row.valor
            return {"chave": chave, "valor": valor_parsed, "atualizado_em": tenant_row.atualizado_em}

    row = (await db.execute(select(ConfiguracaoSistema).where(ConfiguracaoSistema.chave == chave))).scalar_one_or_none()
    if not row:
        # Return defaults for well-known keys rather than 404
        if chave == "nav_permissoes":
            return {"chave": chave, "valor": NAV_DEFAULTS, "atualizado_em": None}
        if chave == "seguranca_copia":
            return {"chave": chave, "valor": True, "atualizado_em": None}
        if chave == "signup_enabled":
            return {"chave": chave, "valor": True, "atualizado_em": None}
        raise HTTPException(status_code=404, detail="Configuração não encontrada")
    try:
        valor_parsed = json.loads(row.valor)
    except Exception:
        valor_parsed = row.valor
    return {"chave": row.chave, "valor": valor_parsed, "atualizado_em": row.atualizado_em}


@router.put("/{chave}")
async def set_configuracao(
    chave: str,
    body: ConfigSet,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role_global != "admin" and not user.is_superadmin:
        raise HTTPException(status_code=403, detail="Apenas administradores podem alterar configurações.")

    # nav_permissoes: tenant admins write to their own scoped key so they don't
    # overwrite the global default used by other tenants.
    actual_chave = chave
    if chave == "nav_permissoes" and user.tenant_id and not user.is_superadmin:
        actual_chave = f"nav_permissoes_{user.tenant_id}"

    valor_str = json.dumps(body.valor, ensure_ascii=False) if not isinstance(body.valor, str) else body.valor

    row = (await db.execute(select(ConfiguracaoSistema).where(ConfiguracaoSistema.chave == actual_chave))).scalar_one_or_none()
    if row:
        row.valor = valor_str
        if body.descricao is not None:
            row.descricao = body.descricao
        row.atualizado_em = datetime.now(timezone.utc)
    else:
        row = ConfiguracaoSistema(
            chave=actual_chave,
            valor=valor_str,
            descricao=body.descricao,
            atualizado_em=datetime.now(timezone.utc),
        )
        db.add(row)

    await db.commit()
    await db.refresh(row)
    # Invalidate nav cache in auth.py if nav_permissoes was updated
    if "nav_permissoes" in chave:
        try:
            from app.routers.auth import _nav_cache_invalidate
            _nav_cache_invalidate(user.tenant_id)
        except Exception:
            pass
    try:
        valor_parsed = json.loads(row.valor)
    except Exception:
        valor_parsed = row.valor
    return {"chave": chave, "valor": valor_parsed, "atualizado_em": row.atualizado_em}
