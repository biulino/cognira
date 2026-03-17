"""Per-client module management (Planos de Módulos).

GET  /clientes/catalogo         — public: full plano/module catalog
GET  /clientes/me/modulos       — current user: active module keys
GET  /clientes/{id}/modulos     — admin: get all module flags for a client
PUT  /clientes/{id}/modulos     — admin: bulk upsert module flags
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, require_role, tenant_filter
from app.models.client import Cliente
from app.models.modulo import ALL_MODULE_KEYS, CATALOGO_PLANOS, ClienteModulo
from app.models.user import Utilizador

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class ModuloFlag(BaseModel):
    modulo: str
    activo: bool


# ── Catalog (no auth required) ────────────────────────────────────────────────

@router.get("/catalogo")
async def get_catalogo():
    """Public catalog of all planos and their modules."""
    return {"catalogo": CATALOGO_PLANOS}


# ── Current user's active modules ─────────────────────────────────────────────
# NOTE: this route must be declared BEFORE /{cliente_id}/modulos so that the
# literal path segment "me" is not mistakenly coerced to an integer.

@router.get("/me/modulos")
async def get_my_modulos(
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Active module keys for the current user's client.

    - Platform superadmins and users without a client get all modules (``all: true``).
    - Tenant admins (role_global=="admin") are filtered by their client's modules like any other role.
    - Clients not yet configured get all modules (backwards compat).
    """
    if user.is_superadmin or user.cliente_id is None:
        return {"modulos": sorted(ALL_MODULE_KEYS), "all": True}

    all_rows = (
        await db.execute(
            select(ClienteModulo).where(ClienteModulo.cliente_id == user.cliente_id)
        )
    ).scalars().all()

    # No configuration yet → default everything on
    if not all_rows:
        return {"modulos": sorted(ALL_MODULE_KEYS), "all": True}

    active = [r.modulo for r in all_rows if r.activo]
    return {"modulos": active, "all": False}


# ── Admin: per-client module management ───────────────────────────────────────

@router.get("/{cliente_id}/modulos")
async def get_cliente_modulos(
    cliente_id: int,
    user: Utilizador = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Return the full catalog annotated with per-client activo flags."""
    await _check_cliente(cliente_id, db, user)

    rows = (
        await db.execute(
            select(ClienteModulo).where(ClienteModulo.cliente_id == cliente_id)
        )
    ).scalars().all()
    existing = {r.modulo: r.activo for r in rows}

    # Modules not yet in DB default to True (not yet restricted)
    flags = {key: existing.get(key, True) for key in ALL_MODULE_KEYS}

    return {
        "cliente_id": cliente_id,
        "catalogo": CATALOGO_PLANOS,
        "flags": flags,
    }


@router.put("/{cliente_id}/modulos", status_code=200)
async def set_cliente_modulos(
    cliente_id: int,
    body: list[ModuloFlag],
    user: Utilizador = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Bulk-upsert module flags for a client.

    Send only the flags you want to change; unchanged flags are untouched.
    To reset everything to defaults, send an empty list (no-op).
    """
    await _check_cliente(cliente_id, db, user)

    invalid = {f.modulo for f in body} - ALL_MODULE_KEYS
    if invalid:
        raise HTTPException(
            status_code=400, detail=f"Módulos inválidos: {sorted(invalid)}"
        )

    if not body:
        return {"ok": True, "updated": 0}

    keys_to_update = {f.modulo for f in body}
    await db.execute(
        delete(ClienteModulo).where(
            ClienteModulo.cliente_id == cliente_id,
            ClienteModulo.modulo.in_(keys_to_update),
        )
    )
    for flag in body:
        db.add(
            ClienteModulo(
                cliente_id=cliente_id, modulo=flag.modulo, activo=flag.activo
            )
        )
    await db.commit()
    return {"ok": True, "updated": len(body)}


# ── Helper ────────────────────────────────────────────────────────────────────

async def _check_cliente(cliente_id: int, db: AsyncSession, user: Optional[Utilizador] = None) -> None:
    stmt = select(Cliente).where(Cliente.id == cliente_id)
    if user is not None:
        tid = tenant_filter(user)
        if tid is not None:
            stmt = stmt.where(Cliente.tenant_id == tid)
    row = (await db.execute(stmt)).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
