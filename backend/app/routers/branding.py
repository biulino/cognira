"""
/api/branding — Platform white-label + per-tenant branding

GET  /api/branding                        — Public. Detects tenant by Host header
                                            → returns tenant branding if subdomain
                                            matches a PortalCliente, else platform defaults.
PUT  /api/branding/{key}                  — Admin. Update platform branding key.

GET  /api/branding/tenant/{subdominio}    — Public. Returns branding for a specific subdomain.
GET  /api/branding/clientes               — Admin. List all portal configs.
GET  /api/branding/clientes/{cliente_id}  — Admin. Get portal config for a client.
PUT  /api/branding/clientes/{cliente_id}  — Admin. Upsert portal config for a client.
"""
import json
import time
from typing import Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.settings import ConfiguracaoSistema
from app.models.client import Cliente, PortalCliente
from app.models.tenant import Tenant
from app.models.user import Utilizador

router = APIRouter()

# ── Platform-level defaults ───────────────────────────────────────────────────

BRANDING_DEFAULTS: dict = {
    "app_name":        "Cognira",
    "tagline":         "CX Intelligence Platform",
    "primary_color":   "#2D6BEE",
    "secondary_color": "#0F1B3D",
    "logo_url":        "/logo.svg",
    "favicon_url":     None,
}
BRANDING_KEYS = list(BRANDING_DEFAULTS.keys())


def _db_key(k: str) -> str:
    return f"branding_{k}"


# ── Simple TTL in-memory cache (60 s per key) ─────────────────────────────────
_CACHE_TTL = 60.0  # seconds
_cache_store: dict[str, tuple[float, Any]] = {}


def _cache_get(key: str) -> Any:
    entry = _cache_store.get(key)
    if entry and time.monotonic() - entry[0] < _CACHE_TTL:
        return entry[1]
    return None


def _cache_set(key: str, val: Any) -> None:
    _cache_store[key] = (time.monotonic(), val)


def _cache_invalidate_prefix(prefix: str) -> None:
    for k in list(_cache_store):
        if k.startswith(prefix):
            del _cache_store[k]


async def _get_platform_branding(db: AsyncSession) -> dict:
    cached = _cache_get("platform")
    if cached is not None:
        return cached
    rows = (
        await db.execute(
            select(ConfiguracaoSistema).where(
                ConfiguracaoSistema.chave.in_([_db_key(k) for k in BRANDING_KEYS])
            )
        )
    ).scalars().all()
    result: dict = dict(BRANDING_DEFAULTS)
    for row in rows:
        key = row.chave.removeprefix("branding_")
        if key in result:
            try:
                result[key] = json.loads(row.valor)
            except Exception:
                result[key] = row.valor if row.valor not in ("null", "") else None
    _cache_set("platform", result)
    return result


def _portal_to_branding(portal: PortalCliente, platform: dict) -> dict:
    """Merge portal-client config on top of platform defaults."""
    return {
        "app_name":        portal.nome_marca or platform["app_name"],
        "tagline":         platform["tagline"],
        "primary_color":   portal.cor_primaria or platform["primary_color"],
        "secondary_color": portal.cor_secundaria or platform["secondary_color"],
        "logo_url":        portal.logo_url_minio or platform["logo_url"],
        "favicon_url":     portal.favicon_url or platform["favicon_url"],
        "css_custom":      portal.css_custom,
        "tenant":          portal.subdominio,
        "cliente_id":      portal.cliente_id,
    }


# ── Public: detect tenant from Host header ────────────────────────────────────

@router.get("")
async def get_branding(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Public. Detects tenant from the Host header.
    e.g. Host: acme.marketview.io  →  subdomain = acme →  look up PortalCliente.
    Falls back to platform branding when no tenant matches.
    """
    platform = await _get_platform_branding(db)

    host = request.headers.get("host", "")
    # Strip port if present
    hostname = host.split(":")[0]
    parts = hostname.split(".")
    subdomain = parts[0] if len(parts) >= 3 else None

    cache_key = f"host_{subdomain or '_default'}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    if subdomain and subdomain not in ("www", "app", "api"):
        # 1. Check Tenant table first (agency-level tenants)
        tenant = (
            await db.execute(
                select(Tenant).where(
                    Tenant.slug == subdomain,
                    Tenant.status.in_(["active", "trial"]),
                )
            )
        ).scalar_one_or_none()
        if tenant:
            result = {
                "app_name":        tenant.nome_marca or tenant.nome or platform["app_name"],
                "tagline":         platform["tagline"],
                "primary_color":   tenant.cor_primaria or platform["primary_color"],
                "secondary_color": tenant.cor_secundaria or platform["secondary_color"],
                "logo_url":        tenant.logo_url or platform["logo_url"],
                "favicon_url":     tenant.favicon_url or platform["favicon_url"],
                "css_custom":      tenant.css_custom,
                "tenant":          tenant.slug,
                "tenant_id":       tenant.id,
                "tenant_status":   tenant.status,
            }
            _cache_set(cache_key, result)
            return result

        # 2. Fall back to PortalCliente (per-retail-brand portals)
        portal = (
            await db.execute(
                select(PortalCliente).where(
                    PortalCliente.subdominio == subdomain,
                    PortalCliente.activo == True,  # noqa: E712
                )
            )
        ).scalar_one_or_none()
        if portal:
            result = _portal_to_branding(portal, platform)
            _cache_set(cache_key, result)
            return result

    _cache_set(cache_key, platform)
    return platform


# ── Tenant/me — returns tenant info for the logged-in admin ─────────────────

@router.get("/tenant/me")
async def get_my_tenant(
    db: AsyncSession = Depends(get_db),
    user: Utilizador = Depends(get_current_user),
):
    """Authenticated. Returns the current user's tenant info for the admin panel."""
    if not user.tenant_id:
        raise HTTPException(403, "Utilizador sem tenant associado")
    tenant = (await db.execute(select(Tenant).where(Tenant.id == user.tenant_id))).scalar_one_or_none()
    if not tenant:
        raise HTTPException(404, "Tenant não encontrado")
    return {
        "nome":          tenant.nome,
        "nome_marca":    tenant.nome_marca,
        "slug":          tenant.slug,
        "status":        tenant.status,
        "trial_ends_at": tenant.trial_ends_at,
        "cor_primaria":  tenant.cor_primaria,
        "cor_secundaria":tenant.cor_secundaria,
        "logo_url":      tenant.logo_url,
        "plano": {
            "nome":               tenant.plano.nome if tenant.plano else None,
            "max_utilizadores":   tenant.plano.max_utilizadores if tenant.plano else None,
            "max_clientes":       tenant.plano.max_clientes if tenant.plano else None,
            "max_visitas_mes":    tenant.plano.max_visitas_mes if tenant.plano else None,
        } if tenant.plano else None,
    }


# ── Public: branding by explicit subdomain ────────────────────────────────────

@router.get("/tenant/{subdominio}")
async def get_tenant_branding(subdominio: str, db: AsyncSession = Depends(get_db)):
    """Public. Returns branding for a specific tenant subdomain (checks Tenant then PortalCliente)."""
    platform = await _get_platform_branding(db)

    # Check agency-level Tenant first
    tenant = (
        await db.execute(
            select(Tenant).where(
                Tenant.slug == subdominio,
                Tenant.status.in_(["active", "trial"]),
            )
        )
    ).scalar_one_or_none()
    if tenant:
        return {
            "app_name":        tenant.nome_marca or tenant.nome or platform["app_name"],
            "tagline":         platform["tagline"],
            "primary_color":   tenant.cor_primaria or platform["primary_color"],
            "secondary_color": tenant.cor_secundaria or platform["secondary_color"],
            "logo_url":        tenant.logo_url or platform["logo_url"],
            "favicon_url":     tenant.favicon_url or platform["favicon_url"],
            "css_custom":      tenant.css_custom,
            "tenant":          tenant.slug,
            "tenant_id":       tenant.id,
        }

    portal = (
        await db.execute(
            select(PortalCliente).where(
                PortalCliente.subdominio == subdominio,
                PortalCliente.activo == True,  # noqa: E712
            )
        )
    ).scalar_one_or_none()
    if not portal:
        raise HTTPException(status_code=404, detail=f"Tenant '{subdominio}' não encontrado")
    return _portal_to_branding(portal, platform)


# ── Admin: list all portal configs ───────────────────────────────────────────

@router.get("/clientes")
async def list_portais(
    db: AsyncSession = Depends(get_db),
    user: Utilizador = Depends(get_current_user),
):
    if user.role_global != "admin":
        raise HTTPException(403)
    rows = (await db.execute(select(PortalCliente))).scalars().all()
    return rows


# ── Admin: get portal config for one client ───────────────────────────────────

@router.get("/clientes/{cliente_id}")
async def get_portal(
    cliente_id: int,
    db: AsyncSession = Depends(get_db),
    user: Utilizador = Depends(get_current_user),
):
    if user.role_global != "admin":
        raise HTTPException(403)
    portal = (
        await db.execute(select(PortalCliente).where(PortalCliente.cliente_id == cliente_id))
    ).scalar_one_or_none()
    if not portal:
        return {}
    return portal


# ── Admin: upsert portal config ───────────────────────────────────────────────

class PortalUpsert(BaseModel):
    subdominio: str
    nome_marca: str
    cor_primaria: Optional[str] = "#1E40AF"
    cor_secundaria: Optional[str] = "#3B82F6"
    logo_url_minio: Optional[str] = None
    favicon_url: Optional[str] = None
    dominio_custom: Optional[str] = None
    css_custom: Optional[str] = None
    activo: bool = True


@router.put("/clientes/{cliente_id}")
async def upsert_portal(
    cliente_id: int,
    body: PortalUpsert,
    db: AsyncSession = Depends(get_db),
    user: Utilizador = Depends(get_current_user),
):
    if user.role_global != "admin":
        raise HTTPException(403, "Apenas administradores podem configurar portais.")

    # Verify client exists
    cliente = (await db.execute(select(Cliente).where(Cliente.id == cliente_id))).scalar_one_or_none()
    if not cliente:
        raise HTTPException(404, "Cliente não encontrado")

    # Check subdomain uniqueness (allow own subdomain)
    conflict = (
        await db.execute(
            select(PortalCliente).where(
                PortalCliente.subdominio == body.subdominio,
                PortalCliente.cliente_id != cliente_id,
            )
        )
    ).scalar_one_or_none()
    if conflict:
        raise HTTPException(409, f"Subdomínio '{body.subdominio}' já está em uso por outro cliente.")

    portal = (
        await db.execute(select(PortalCliente).where(PortalCliente.cliente_id == cliente_id))
    ).scalar_one_or_none()

    if portal:
        portal.subdominio = body.subdominio
        portal.nome_marca = body.nome_marca
        portal.cor_primaria = body.cor_primaria or "#1E40AF"
        portal.cor_secundaria = body.cor_secundaria or "#3B82F6"
        portal.logo_url_minio = body.logo_url_minio
        portal.favicon_url = body.favicon_url
        portal.dominio_custom = body.dominio_custom
        portal.css_custom = body.css_custom
        portal.activo = body.activo
    else:
        portal = PortalCliente(
            cliente_id=cliente_id,
            subdominio=body.subdominio,
            nome_marca=body.nome_marca,
            cor_primaria=body.cor_primaria or "#1E40AF",
            cor_secundaria=body.cor_secundaria or "#3B82F6",
            logo_url_minio=body.logo_url_minio,
            favicon_url=body.favicon_url,
            dominio_custom=body.dominio_custom,
            css_custom=body.css_custom,
            activo=body.activo,
        )
        db.add(portal)

    await db.commit()
    await db.refresh(portal)
    # Invalidate branding cache for this subdomain
    _cache_invalidate_prefix(f"host_{portal.subdominio}")
    return portal


# ── Admin: platform-level branding key update ─────────────────────────────────

class BrandingValue(BaseModel):
    valor: str | None = None


@router.put("/{key}")
async def set_branding_key(
    key: str,
    body: BrandingValue,
    db: AsyncSession = Depends(get_db),
    user: Utilizador = Depends(get_current_user),
):
    if user.role_global != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem alterar o branding.")
    if key not in BRANDING_KEYS:
        raise HTTPException(status_code=400, detail=f"Chave inválida: {key}. Valores aceites: {BRANDING_KEYS}")

    db_key = _db_key(key)
    valor_str = json.dumps(body.valor, ensure_ascii=False)

    row = (
        await db.execute(select(ConfiguracaoSistema).where(ConfiguracaoSistema.chave == db_key))
    ).scalar_one_or_none()

    if row:
        row.valor = valor_str
    else:
        row = ConfiguracaoSistema(chave=db_key, valor=valor_str, descricao=f"Branding: {key}")
        db.add(row)

    await db.commit()
    # Invalidate platform branding cache so next request re-reads from DB
    _cache_invalidate_prefix("platform")
    _cache_invalidate_prefix("host_")
    return {"key": key, "valor": body.valor}
