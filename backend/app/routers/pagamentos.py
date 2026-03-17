from typing import Optional
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, require_role, tenant_filter
from app.models.analyst import Analista
from app.models.client import Cliente
from app.models.payment import PagamentoVisita
from app.models.study import Estudo
from app.models.visit import Visita
from app.models.user import Utilizador
from app.schemas import PagamentoCreate, PagamentoOut
from app.services import pii

router = APIRouter()


@router.get("/", response_model=list[PagamentoOut])
async def list_pagamentos(
    analista_id: Optional[int] = None,
    estado: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=2000),
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(PagamentoVisita)
    tid = tenant_filter(user)
    if tid is not None:
        q = (
            q
            .join(Analista, Analista.id == PagamentoVisita.analista_id)
            .where(Analista.tenant_id == tid)
        )
    if analista_id:
        q = q.where(PagamentoVisita.analista_id == analista_id)
    if estado:
        q = q.where(PagamentoVisita.estado == estado)
    q = q.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/", response_model=PagamentoOut, status_code=201)
async def create_pagamento(
    body: PagamentoCreate,
    user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    pag = PagamentoVisita(
        visita_id=body.visita_id,
        analista_id=body.analista_id,
        valor_base=body.valor_base,
        valor_despesas=body.valor_despesas,
        valor_total=body.valor_base + body.valor_despesas,
    )
    db.add(pag)
    await db.flush()
    await db.refresh(pag)
    return pag


@router.put("/{pag_id}/aprovar", response_model=PagamentoOut)
async def aprovar_pagamento(
    pag_id: int,
    user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    q = select(PagamentoVisita).where(PagamentoVisita.id == pag_id)
    tid = tenant_filter(user)
    if tid is not None:
        q = (
            q
            .join(Analista, Analista.id == PagamentoVisita.analista_id)
            .where(Analista.tenant_id == tid)
        )
    pag = (await db.execute(q)).scalar_one_or_none()
    if not pag:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado")
    if pag.estado == "aprovado":
        raise HTTPException(status_code=409, detail="Pagamento já aprovado")
    pag.estado = "aprovado"
    pag.aprovado_por = user.id
    await db.flush()
    await db.refresh(pag)
    return pag


@router.get("/relatorio/analistas")
async def relatorio_por_analista(
    estado: Optional[str] = None,
    estudo_id: Optional[int] = None,
    data_inicio: Optional[date] = Query(None, description="Início do período (YYYY-MM-DD)"),
    data_fim: Optional[date] = Query(None, description="Fim do período (YYYY-MM-DD)"),
    user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    """Breakdown of payments grouped by analista, with optional period and study filters."""
    q = select(
        PagamentoVisita.analista_id,
        func.count(PagamentoVisita.id).label("total_pagamentos"),
        func.sum(PagamentoVisita.valor_total).label("valor_total"),
        func.sum(PagamentoVisita.valor_base).label("valor_base"),
        func.sum(PagamentoVisita.valor_despesas).label("valor_despesas"),
    ).group_by(PagamentoVisita.analista_id)

    filters = []
    tid = tenant_filter(user)
    if tid is not None:
        # Scope to analistas in the current tenant
        q = q.join(Analista, Analista.id == PagamentoVisita.analista_id)
        filters.append(Analista.tenant_id == tid)
    if estado:
        filters.append(PagamentoVisita.estado == estado)
    if estudo_id:
        filters.append(
            PagamentoVisita.visita_id.in_(
                select(Visita.id).where(Visita.estudo_id == estudo_id)
            )
        )
    if data_inicio:
        filters.append(PagamentoVisita.pago_em >= data_inicio)
    if data_fim:
        filters.append(PagamentoVisita.pago_em <= data_fim)
    if filters:
        q = q.where(and_(*filters))

    rows = (await db.execute(q)).all()

    analista_ids = [r.analista_id for r in rows]
    analistas_stmt = select(Analista).where(Analista.id.in_(analista_ids))
    analistas_result = await db.execute(analistas_stmt)
    analistas_map = {
        a.id: a.nome.decode("utf-8", errors="replace") if isinstance(a.nome, (bytes, bytearray)) else (a.nome or "—")
        for a in analistas_result.scalars().all()
    }

    return [
        {
            "analista_id": r.analista_id,
            "analista_nome": analistas_map.get(r.analista_id, "—"),
            "total_pagamentos": r.total_pagamentos,
            "valor_total": round(float(r.valor_total or 0), 2),
            "valor_base": round(float(r.valor_base or 0), 2),
            "valor_despesas": round(float(r.valor_despesas or 0), 2),
        }
        for r in sorted(rows, key=lambda x: float(x.valor_total or 0), reverse=True)
    ]


@router.get("/relatorio/detalhe")
async def relatorio_detalhe(
    analista_id: Optional[int] = None,
    estudo_id: Optional[int] = None,
    estado: Optional[str] = None,
    data_inicio: Optional[date] = Query(None),
    data_fim: Optional[date] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
    user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    """Per-visit payment detail — filterable by analista, study, status and period."""
    from app.models.establishment import Estabelecimento
    from app.models.study import Estudo

    q = (
        select(
            PagamentoVisita,
            Visita.estudo_id.label("v_estudo_id"),
            Estudo.nome.label("estudo_nome"),
            Estabelecimento.nome.label("estabelecimento_nome"),
            Analista.nome.label("analista_nome_raw"),
        )
        .join(Visita, Visita.id == PagamentoVisita.visita_id)
        .join(Estudo, Estudo.id == Visita.estudo_id)
        .join(Estabelecimento, Estabelecimento.id == Visita.estabelecimento_id)
        .join(Analista, Analista.id == PagamentoVisita.analista_id)
        .join(Cliente, Cliente.id == Estudo.cliente_id)
    )

    filters = []
    tid = tenant_filter(user)
    if tid is not None:
        filters.append(Cliente.tenant_id == tid)
    if analista_id:
        filters.append(PagamentoVisita.analista_id == analista_id)
    if estudo_id:
        filters.append(Visita.estudo_id == estudo_id)
    if estado:
        filters.append(PagamentoVisita.estado == estado)
    if data_inicio:
        filters.append(PagamentoVisita.pago_em >= data_inicio)
    if data_fim:
        filters.append(PagamentoVisita.pago_em <= data_fim)
    if filters:
        q = q.where(and_(*filters))

    q = q.order_by(PagamentoVisita.id.desc()).offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(q)).all()

    return [
        {
            "id": row.PagamentoVisita.id,
            "visita_id": row.PagamentoVisita.visita_id,
            "analista_id": row.PagamentoVisita.analista_id,
            "analista_nome": (
                row.analista_nome_raw.decode("utf-8", errors="replace")
                if isinstance(row.analista_nome_raw, (bytes, bytearray))
                else (row.analista_nome_raw or "—")
            ),
            "estudo_nome": row.estudo_nome,
            "estabelecimento_nome": row.estabelecimento_nome,
            "valor_base": round(float(row.PagamentoVisita.valor_base or 0), 2),
            "valor_despesas": round(float(row.PagamentoVisita.valor_despesas or 0), 2),
            "valor_total": round(float(row.PagamentoVisita.valor_total or 0), 2),
            "estado": row.PagamentoVisita.estado,
            "pago_em": row.PagamentoVisita.pago_em.isoformat() if row.PagamentoVisita.pago_em else None,
        }
        for row in rows
    ]

