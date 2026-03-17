"""CRUD API for shelf audit items (retail audit module — Wave 5)."""
from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, require_role, tenant_filter
from app.models.client import Cliente
from app.models.shelf_audit import ShelfAuditItem
from app.models.study import Estudo
from app.models.visit import Visita
from app.models.user import Utilizador
from app.schemas import ShelfAuditItemCreate, ShelfAuditItemOut

router = APIRouter()


async def _assert_visita_tenant(visita_id: int, user: Utilizador, db: AsyncSession) -> None:
    """Raise 404 if the visita doesn't exist or belongs to a different tenant."""
    tid = tenant_filter(user)
    if tid is None:
        return  # superadmin sees all
    row = (
        await db.execute(
            select(Visita.id)
            .join(Estudo, Visita.estudo_id == Estudo.id)
            .join(Cliente, Estudo.cliente_id == Cliente.id)
            .where(Visita.id == visita_id, Cliente.tenant_id == tid)
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(404, "Visita não encontrada")


# ── List items for a visit ────────────────────────────────────────────────────

@router.get("/{visita_id}", response_model=list[ShelfAuditItemOut])
async def list_shelf_items(
    visita_id: int,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _assert_visita_tenant(visita_id, user, db)
    items = (
        await db.execute(
            select(ShelfAuditItem)
            .where(ShelfAuditItem.visita_id == visita_id)
            .order_by(ShelfAuditItem.criado_em)
        )
    ).scalars().all()
    return items


# ── Summary stats for a visit ─────────────────────────────────────────────────

@router.get("/{visita_id}/summary")
async def shelf_summary(
    visita_id: int,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _assert_visita_tenant(visita_id, user, db)
    rows = (
        await db.execute(
            select(ShelfAuditItem).where(ShelfAuditItem.visita_id == visita_id)
        )
    ).scalars().all()

    total = len(rows)
    conformes = sum(1 for r in rows if r.conforme)
    out_of_stock = sum(1 for r in rows if r.quantidade_real == 0)
    price_deviations = sum(
        1 for r in rows
        if r.preco_esperado and r.preco_real and abs(float(r.preco_real) - float(r.preco_esperado)) > 0.01
    )

    return {
        "total_itens": total,
        "conformes": conformes,
        "nao_conformes": total - conformes,
        "compliance_rate": round(conformes / total * 100, 1) if total else None,
        "out_of_stock": out_of_stock,
        "desvios_preco": price_deviations,
    }


# ── Create ────────────────────────────────────────────────────────────────────

@router.post("/", response_model=ShelfAuditItemOut, status_code=201)
async def create_shelf_item(
    body: ShelfAuditItemCreate,
    user: Utilizador = Depends(require_role("admin", "coordenador", "analista")),
    db: AsyncSession = Depends(get_db),
):
    await _assert_visita_tenant(body.visita_id, user, db)
    item = ShelfAuditItem(**body.model_dump())
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


# ── Update ────────────────────────────────────────────────────────────────────

@router.put("/{item_id}", response_model=ShelfAuditItemOut)
async def update_shelf_item(
    item_id: int,
    body: ShelfAuditItemCreate,
    user: Utilizador = Depends(require_role("admin", "coordenador", "analista")),
    db: AsyncSession = Depends(get_db),
):
    item = (
        await db.execute(select(ShelfAuditItem).where(ShelfAuditItem.id == item_id))
    ).scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Item não encontrado")
    await _assert_visita_tenant(item.visita_id, user, db)

    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(item, k, v)
    await db.flush()
    await db.refresh(item)
    return item


# ── Delete ────────────────────────────────────────────────────────────────────

@router.delete("/{item_id}", status_code=204)
async def delete_shelf_item(
    item_id: int,
    user: Utilizador = Depends(require_role("admin", "coordenador", "analista")),
    db: AsyncSession = Depends(get_db),
):
    item = (
        await db.execute(select(ShelfAuditItem).where(ShelfAuditItem.id == item_id))
    ).scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Item não encontrado")
    await _assert_visita_tenant(item.visita_id, user, db)
    await db.delete(item)


# ── Wave 5.5 — AI Compliance Analysis ────────────────────────────────────────

@router.post("/{visita_id}/analisar-ia")
async def analisar_shelf_ia(
    visita_id: int,
    user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    """Run GPT analysis on all shelf-audit items for a visit and persist result."""
    await _assert_visita_tenant(visita_id, user, db)
    from app.ai.intelligence import analisar_shelf_audit
    return await analisar_shelf_audit(visita_id=visita_id, db=db)


# ── Wave 7.3 — Excel Export ───────────────────────────────────────────────────

@router.get("/export")
async def export_shelf_excel(
    estudo_id: Optional[int] = Query(None),
    visita_id: Optional[int] = Query(None),
    user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    """Export shelf audit items to XLSX.  Filter by visita_id or estudo_id."""
    import io
    from openpyxl import Workbook

    q = select(ShelfAuditItem, Visita).join(Visita, ShelfAuditItem.visita_id == Visita.id)
    tid = tenant_filter(user)
    if tid is not None:
        q = q.join(Estudo, Visita.estudo_id == Estudo.id).join(
            Cliente, Estudo.cliente_id == Cliente.id
        ).where(Cliente.tenant_id == tid)
    if visita_id:
        q = q.where(ShelfAuditItem.visita_id == visita_id)
    elif estudo_id:
        q = q.where(Visita.estudo_id == estudo_id)
    else:
        raise HTTPException(422, "Forneça visita_id ou estudo_id.")

    rows = (await db.execute(q)).all()

    wb = Workbook()
    ws = wb.active
    ws.title = "Shelf Audit"
    ws.append([
        "Visita ID", "Produto", "EAN",
        "Preço Esp.", "Preço Real",
        "Qtd Esp.", "Qtd Real",
        "Facings", "Validade",
        "Conforme", "Notas",
    ])
    for item, visita in rows:
        ws.append([
            item.visita_id,
            item.produto_nome,
            item.ean or "",
            float(item.preco_esperado) if item.preco_esperado else "",
            float(item.preco_real) if item.preco_real else "",
            item.quantidade_esperada if item.quantidade_esperada is not None else "",
            item.quantidade_real if item.quantidade_real is not None else "",
            item.facings if item.facings is not None else "",
            str(item.validade) if item.validade else "",
            "Sim" if item.conforme else "Não",
            item.notas or "",
        ])

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=shelf_audit.xlsx"},
    )

