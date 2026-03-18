"""
/api/superadmin/tenants  — Super-admin CRUD for tenants
/api/superadmin/planos   — Super-admin plans management
/api/superadmin/stats    — Platform MRR stats
"""
from datetime import datetime, timezone
from typing import Optional
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_superadmin
from app.models.tenant import Tenant, PlanoTenant
from app.edition import require_pro
from app.models.user import Utilizador

router = APIRouter()


# ── Plans ─────────────────────────────────────────────────────────────────────

@router.get("/planos")
async def list_planos(
    db: AsyncSession = Depends(get_db),
    _: Utilizador = Depends(get_superadmin),
):
    require_pro("superadmin")
    rows = (await db.execute(select(PlanoTenant).order_by(PlanoTenant.ordem))).scalars().all()
    return rows


@router.get("/planos/public")
async def list_planos_public(db: AsyncSession = Depends(get_db)):
    """Public endpoint — returns sellable plans for the /signup page."""
    rows = (
        await db.execute(
            select(PlanoTenant)
            .where(PlanoTenant.is_public == True, PlanoTenant.is_active == True)  # noqa: E712
            .order_by(PlanoTenant.ordem)
        )
    ).scalars().all()
    return rows


class PlanoUpdate(BaseModel):
    nome: Optional[str] = None
    descricao: Optional[str] = None
    preco_mensal: Optional[Decimal] = None
    max_utilizadores: Optional[int] = None
    max_clientes: Optional[int] = None
    max_visitas_mes: Optional[int] = None
    trial_dias: Optional[int] = None
    features: Optional[dict] = None
    is_public: Optional[bool] = None
    is_active: Optional[bool] = None
    ordem: Optional[int] = None


@router.put("/planos/{plano_id}")
async def update_plano(
    plano_id: int,
    body: PlanoUpdate,
    db: AsyncSession = Depends(get_db),
    _: Utilizador = Depends(get_superadmin),
):
    plano = (await db.execute(select(PlanoTenant).where(PlanoTenant.id == plano_id))).scalar_one_or_none()
    if not plano:
        raise HTTPException(404, "Plano não encontrado")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(plano, field, val)
    await db.commit()
    await db.refresh(plano)
    return plano


# ── Tenants ────────────────────────────────────────────────────────────────────

@router.get("/tenants")
async def list_tenants(
    q: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: Utilizador = Depends(get_superadmin),
):
    require_pro("superadmin")
    stmt = select(Tenant).order_by(Tenant.criado_em.desc())
    if q:
        stmt = stmt.where(
            Tenant.nome.ilike(f"%{q}%") | Tenant.slug.ilike(f"%{q}%") | Tenant.owner_email.ilike(f"%{q}%")
        )
    if status:
        stmt = stmt.where(Tenant.status == status)
    rows = (await db.execute(stmt)).scalars().all()
    return rows


@router.get("/tenants/{tenant_id}")
async def get_tenant(
    tenant_id: int,
    db: AsyncSession = Depends(get_db),
    _: Utilizador = Depends(get_superadmin),
):
    tenant = (await db.execute(select(Tenant).where(Tenant.id == tenant_id))).scalar_one_or_none()
    if not tenant:
        raise HTTPException(404, "Tenant não encontrado")
    # Attach user count
    user_count = (
        await db.execute(
            select(func.count(Utilizador.id)).where(Utilizador.tenant_id == tenant_id)
        )
    ).scalar_one()
    result = {
        "id": tenant.id,
        "slug": tenant.slug,
        "nome": tenant.nome,
        "nome_marca": tenant.nome_marca,
        "status": tenant.status,
        "plano": tenant.plano,
        "trial_ends_at": tenant.trial_ends_at,
        "owner_nome": tenant.owner_nome,
        "owner_email": tenant.owner_email,
        "owner_telefone": tenant.owner_telefone,
        "pais": tenant.pais,
        "cor_primaria": tenant.cor_primaria,
        "cor_secundaria": tenant.cor_secundaria,
        "logo_url": tenant.logo_url,
        "favicon_url": tenant.favicon_url,
        "dominio_custom": tenant.dominio_custom,
        "css_custom": tenant.css_custom,
        "notas": tenant.notas,
        "criado_em": tenant.criado_em,
        "utilizadores_count": user_count,
    }
    return result


class TenantUpdate(BaseModel):
    nome: Optional[str] = None
    nome_marca: Optional[str] = None
    status: Optional[str] = None
    plano_id: Optional[int] = None
    cor_primaria: Optional[str] = None
    cor_secundaria: Optional[str] = None
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    dominio_custom: Optional[str] = None
    css_custom: Optional[str] = None
    notas: Optional[str] = None
    owner_nome: Optional[str] = None
    owner_email: Optional[str] = None
    owner_telefone: Optional[str] = None
    pais: Optional[str] = None


@router.patch("/tenants/{tenant_id}")
async def update_tenant(
    tenant_id: int,
    body: TenantUpdate,
    db: AsyncSession = Depends(get_db),
    _: Utilizador = Depends(get_superadmin),
):
    tenant = (await db.execute(select(Tenant).where(Tenant.id == tenant_id))).scalar_one_or_none()
    if not tenant:
        raise HTTPException(404, "Tenant não encontrado")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(tenant, field, val)
    tenant.atualizado_em = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(tenant)
    return tenant


@router.patch("/tenants/{tenant_id}/status")
async def set_tenant_status(
    tenant_id: int,
    status: str,
    db: AsyncSession = Depends(get_db),
    _: Utilizador = Depends(get_superadmin),
):
    valid = {"trial", "active", "suspended", "cancelled"}
    if status not in valid:
        raise HTTPException(400, f"Status inválido. Válidos: {valid}")
    tenant = (await db.execute(select(Tenant).where(Tenant.id == tenant_id))).scalar_one_or_none()
    if not tenant:
        raise HTTPException(404)
    tenant.status = status
    tenant.atualizado_em = datetime.now(timezone.utc)
    await db.commit()
    return {"id": tenant_id, "status": status}


# ── Platform stats ─────────────────────────────────────────────────────────────

@router.get("/stats")
async def platform_stats(
    db: AsyncSession = Depends(get_db),
    _: Utilizador = Depends(get_superadmin),
):
    total_q = await db.execute(select(func.count(Tenant.id)))
    active_q = await db.execute(select(func.count(Tenant.id)).where(Tenant.status == "active"))
    trial_q = await db.execute(select(func.count(Tenant.id)).where(Tenant.status == "trial"))
    suspended_q = await db.execute(select(func.count(Tenant.id)).where(Tenant.status == "suspended"))
    users_q = await db.execute(select(func.count(Utilizador.id)).where(Utilizador.is_superadmin == False))  # noqa: E712

    # MRR = sum of monthly prices for active tenants
    mrr_q = await db.execute(
        select(func.coalesce(func.sum(PlanoTenant.preco_mensal), 0))
        .join(Tenant, Tenant.plano_id == PlanoTenant.id)
        .where(Tenant.status == "active")
    )

    return {
        "total_tenants": total_q.scalar_one(),
        "active_tenants": active_q.scalar_one(),
        "trial_tenants": trial_q.scalar_one(),
        "suspended_tenants": suspended_q.scalar_one(),
        "total_users": users_q.scalar_one(),
        "mrr": float(mrr_q.scalar_one()),
    }


# ── Tenant Admin Creation ─────────────────────────────────────────────────────

class TenantAdminCreate(BaseModel):
    username: str
    email: EmailStr
    password: str


@router.get("/tenants/{tenant_id}/users")
async def list_tenant_users(
    tenant_id: int,
    db: AsyncSession = Depends(get_db),
    _: Utilizador = Depends(get_superadmin),
):
    """List all users belonging to a specific tenant."""
    users = (
        await db.execute(
            select(Utilizador)
            .where(Utilizador.tenant_id == tenant_id)
            .order_by(Utilizador.criado_em.desc())
        )
    ).scalars().all()
    return [
        {
            "id": str(u.id),
            "username": u.username,
            "role_global": u.role_global,
            "activo": u.activo,
        }
        for u in users
    ]


@router.post("/tenants/{tenant_id}/admin", status_code=201)
async def create_tenant_admin(
    tenant_id: int,
    body: TenantAdminCreate,
    db: AsyncSession = Depends(get_db),
    _: Utilizador = Depends(get_superadmin),
):
    """Create an admin user for the specified tenant."""
    from app.auth.jwt import hash_password
    from app.services import pii

    if len(body.password) < 8:
        raise HTTPException(400, "Password deve ter pelo menos 8 caracteres")

    tenant = (await db.execute(select(Tenant).where(Tenant.id == tenant_id))).scalar_one_or_none()
    if not tenant:
        raise HTTPException(404, "Tenant não encontrado")

    existing = (await db.execute(select(Utilizador).where(Utilizador.username == body.username))).scalar_one_or_none()
    if existing:
        raise HTTPException(409, "Username já existe")

    new_admin = Utilizador(
        username=body.username,
        email=pii.encrypt(body.email),
        password_hash=hash_password(body.password),
        role_global="admin",
        activo=True,
        tenant_id=tenant_id,
        is_superadmin=False,
    )
    db.add(new_admin)
    await db.commit()
    await db.refresh(new_admin)
    return {"id": new_admin.id, "username": new_admin.username, "tenant_id": tenant_id, "role_global": "admin"}


# ── Platform Superuser Management ─────────────────────────────────────────────

class SuperuserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str


@router.get("/platform-superusers")
async def list_platform_superusers(
    db: AsyncSession = Depends(get_db),
    _: Utilizador = Depends(get_superadmin),
):
    """List all platform-level superusers."""
    rows = (
        await db.execute(
            select(Utilizador.id, Utilizador.username, Utilizador.activo)
            .where(Utilizador.is_superadmin == True)  # noqa: E712
            .order_by(Utilizador.id)
        )
    ).all()
    return [{"id": r.id, "username": r.username, "activo": r.activo} for r in rows]


@router.post("/platform-superusers", status_code=201)
async def create_platform_superuser(
    body: SuperuserCreate,
    db: AsyncSession = Depends(get_db),
    _: Utilizador = Depends(get_superadmin),
):
    """Create a new platform-level superuser (no tenant affiliation)."""
    from app.auth.jwt import hash_password
    from app.services import pii

    if len(body.password) < 8:
        raise HTTPException(400, "Password deve ter pelo menos 8 caracteres")

    existing = (await db.execute(select(Utilizador).where(Utilizador.username == body.username))).scalar_one_or_none()
    if existing:
        raise HTTPException(409, "Username já existe")

    superuser = Utilizador(
        username=body.username,
        email=pii.encrypt(body.email),
        password_hash=hash_password(body.password),
        role_global="admin",
        activo=True,
        tenant_id=None,
        is_superadmin=True,
    )
    db.add(superuser)
    await db.commit()
    await db.refresh(superuser)
    return {"id": superuser.id, "username": superuser.username, "is_superadmin": True}
