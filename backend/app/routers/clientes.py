from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.database import get_db
from app.deps import get_current_user, require_role, tenant_filter
from app.models.client import Cliente
from app.models.modulo import CATALOGO_PLANOS
from app.models.user import Utilizador
from app.schemas import ClienteCreate, ClienteOut

router = APIRouter()


@router.get("/catalogo")
async def get_catalogo():
    """Public catalog of all planos and their modules.
    Declared here (before /{cliente_id}) to avoid parameterised-route shadowing.
    """
    return {"catalogo": CATALOGO_PLANOS}


@router.get("/", response_model=list[ClienteOut])
async def list_clientes(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(Cliente)
    tid = tenant_filter(user)
    if tid is not None:
        q = q.where(Cliente.tenant_id == tid)
    q = q.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/{cliente_id}", response_model=ClienteOut)
async def get_cliente(
    cliente_id: int,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(Cliente).where(Cliente.id == cliente_id)
    tid = tenant_filter(user)
    if tid is not None:
        q = q.where(Cliente.tenant_id == tid)
    result = await db.execute(q)
    cliente = result.scalar_one_or_none()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return cliente


@router.post("/", response_model=ClienteOut, status_code=201)
async def create_cliente(
    body: ClienteCreate,
    user: Utilizador = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    # Plan limit enforcement
    if user.tenant and user.tenant.plano and user.tenant.plano.max_clientes is not None:
        tid = user.tenant_id
        count = (await db.execute(
            select(func.count(Cliente.id)).where(Cliente.tenant_id == tid)
        )).scalar() or 0
        if count >= user.tenant.plano.max_clientes:
            raise HTTPException(status_code=402, detail=f"Limite de clientes do plano atingido ({user.tenant.plano.max_clientes}).")
    cliente = Cliente(nome=body.nome, tenant_id=user.tenant_id)
    db.add(cliente)
    await db.flush()
    await db.refresh(cliente)
    return cliente


@router.put("/{cliente_id}", response_model=ClienteOut)
async def update_cliente(
    cliente_id: int,
    body: ClienteCreate,
    user: Utilizador = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    q = select(Cliente).where(Cliente.id == cliente_id)
    tid = tenant_filter(user)
    if tid is not None:
        q = q.where(Cliente.tenant_id == tid)
    result = await db.execute(q)
    cliente = result.scalar_one_or_none()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    cliente.nome = body.nome
    if body.sla_visita_dias is not None:
        cliente.sla_visita_dias = body.sla_visita_dias
    if body.sla_validacao_dias is not None:
        cliente.sla_validacao_dias = body.sla_validacao_dias
    await db.flush()
    await db.refresh(cliente)
    return cliente


class SlaUpdate(BaseModel):
    sla_visita_dias: Optional[int] = None
    sla_validacao_dias: Optional[int] = None


@router.put("/{cliente_id}/sla", response_model=ClienteOut)
async def update_cliente_sla(
    cliente_id: int,
    body: SlaUpdate,
    user: Utilizador = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Wave 8.8 — Set per-client contractual SLA thresholds."""
    q = select(Cliente).where(Cliente.id == cliente_id)
    tid = tenant_filter(user)
    if tid is not None:
        q = q.where(Cliente.tenant_id == tid)
    result = await db.execute(q)
    cliente = result.scalar_one_or_none()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    if body.sla_visita_dias is not None:
        cliente.sla_visita_dias = max(1, body.sla_visita_dias)
    if body.sla_validacao_dias is not None:
        cliente.sla_validacao_dias = max(1, body.sla_validacao_dias)
    await db.commit()
    await db.refresh(cliente)
    return cliente


@router.delete("/{cliente_id}", status_code=204)
async def delete_cliente(
    cliente_id: int,
    user: Utilizador = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    q = select(Cliente).where(Cliente.id == cliente_id)
    tid = tenant_filter(user)
    if tid is not None:
        q = q.where(Cliente.tenant_id == tid)
    result = await db.execute(q)
    cliente = result.scalar_one_or_none()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    cliente.activo = False
    await db.flush()
