from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, require_role, tenant_filter
from app.models.analyst import Analista, ChillingPeriod, BlacklistEstabelecimento
from app.models.user import Utilizador
from app.schemas import (
    AnalistaCreate, AnalistaOut,
    ChillingPeriodCreate, ChillingPeriodOut,
    BlacklistCreate, BlacklistOut,
)
from app.ai.intelligence import analisar_anomalias_analistas, score_preditivo_analista, coaching_analista
from app.edition import require_pro
from app.services import pii

router = APIRouter()


@router.get("/", response_model=list[AnalistaOut])
async def list_analistas(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=1000),
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(Analista)
    tid = tenant_filter(user)
    if tid is not None:
        q = q.where(Analista.tenant_id == tid)
    q = q.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    return result.scalars().all()


# ---------------------------------------------------------------------------
# Cognira Intelligence — MUST be before /{analista_id} to avoid route shadowing
# ---------------------------------------------------------------------------

@router.get("/anomalias")
async def anomalias_analistas(
    estudo_id: int = Query(..., description="ID do estudo a analisar"),
    dias: int = Query(90, ge=7, le=365, description="Janela temporal em dias"),
    user: Utilizador = Depends(require_role("admin", "coordenador", "validador")),
    db: AsyncSession = Depends(get_db),
):
    """Cognira Module 4 — Detect analista score outliers."""
    require_pro("ai_scoring")
    return await analisar_anomalias_analistas(estudo_id=estudo_id, db=db, dias=dias)


@router.get("/{analista_id}/score-preditivo")
async def score_preditivo(
    analista_id: int,
    user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    """Cognira Module 7 — Predictive quality score for a single analista."""
    require_pro("ai_scoring")
    return await score_preditivo_analista(analista_id=analista_id, db=db)


@router.get("/{analista_id}/coaching-ia")
async def coaching_ia(
    analista_id: int,
    user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    """Cognira Module 14 — AI personalised coaching based on 90-day metrics."""
    require_pro("ai_scoring")
    return await coaching_analista(analista_id=analista_id, db=db)


@router.get("/{analista_id}", response_model=AnalistaOut)
async def get_analista(
    analista_id: int,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(Analista).where(Analista.id == analista_id)
    tid = tenant_filter(user)
    if tid is not None:
        q = q.where(Analista.tenant_id == tid)
    result = await db.execute(q)
    analista = result.scalar_one_or_none()
    if not analista:
        raise HTTPException(status_code=404, detail="Analista não encontrado")
    return analista


@router.post("/", response_model=AnalistaOut, status_code=201)
async def create_analista(
    body: AnalistaCreate,
    user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    analista = Analista(
        tenant_id=user.tenant_id,
        nome=body.nome.encode("utf-8"),  # plain — searchable via SQL
        email=pii.encrypt(body.email) if body.email else b"",
        codigo_externo=body.codigo_externo,
        telefone=pii.encrypt(body.telefone) if body.telefone else None,
        nif=pii.encrypt(body.nif) if body.nif else None,
        iban=pii.encrypt(body.iban) if body.iban else None,
        morada=pii.encrypt(body.morada) if body.morada else None,
        data_nascimento=pii.encrypt(body.data_nascimento) if body.data_nascimento else None,
    )
    db.add(analista)
    await db.flush()
    await db.refresh(analista)
    return analista


@router.put("/{analista_id}", response_model=AnalistaOut)
async def update_analista(
    analista_id: int,
    body: AnalistaCreate,
    user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    q = select(Analista).where(Analista.id == analista_id)
    tid = tenant_filter(user)
    if tid is not None:
        q = q.where(Analista.tenant_id == tid)
    result = await db.execute(q)
    analista = result.scalar_one_or_none()
    if not analista:
        raise HTTPException(status_code=404, detail="Analista não encontrado")
    analista.nome = body.nome.encode("utf-8")  # plain — searchable via SQL
    analista.email = pii.encrypt(body.email) if body.email else b""
    analista.codigo_externo = body.codigo_externo
    analista.telefone = pii.encrypt(body.telefone) if body.telefone else None
    analista.nif = pii.encrypt(body.nif) if body.nif else None
    analista.iban = pii.encrypt(body.iban) if body.iban else None
    analista.morada = pii.encrypt(body.morada) if body.morada else None
    analista.data_nascimento = pii.encrypt(body.data_nascimento) if body.data_nascimento else None
    await db.flush()
    await db.refresh(analista)
    return analista


@router.delete("/{analista_id}", status_code=204)
async def delete_analista(
    analista_id: int,
    user: Utilizador = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    q = select(Analista).where(Analista.id == analista_id)
    tid = tenant_filter(user)
    if tid is not None:
        q = q.where(Analista.tenant_id == tid)
    result = await db.execute(q)
    analista = result.scalar_one_or_none()
    if not analista:
        raise HTTPException(status_code=404, detail="Analista não encontrado")
    analista.activo = False
    await db.flush()


# ---------------------------------------------------------------------------
# Chilling Periods
# ---------------------------------------------------------------------------

@router.get("/{analista_id}/chilling-periods", response_model=list[ChillingPeriodOut])
async def list_chilling_periods(
    analista_id: int,
    user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChillingPeriod)
        .where(ChillingPeriod.analista_id == analista_id, ChillingPeriod.activo == True)
        .order_by(ChillingPeriod.inicio_em.desc())
    )
    return result.scalars().all()


@router.post("/{analista_id}/chilling-periods", response_model=ChillingPeriodOut, status_code=201)
async def create_chilling_period(
    analista_id: int,
    body: ChillingPeriodCreate,
    user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    analista = (await db.execute(select(Analista).where(Analista.id == analista_id))).scalar_one_or_none()
    if not analista:
        raise HTTPException(status_code=404, detail="Analista não encontrado")
    cp = ChillingPeriod(
        analista_id=analista_id,
        estabelecimento_id=body.estabelecimento_id,
        meses=body.meses,
        inicio_em=body.inicio_em,
        fim_em=body.fim_em,
    )
    db.add(cp)
    await db.flush()
    await db.refresh(cp)
    return cp


@router.delete("/{analista_id}/chilling-periods/{cp_id}", status_code=204)
async def delete_chilling_period(
    analista_id: int,
    cp_id: int,
    user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    cp = (
        await db.execute(
            select(ChillingPeriod).where(
                ChillingPeriod.id == cp_id, ChillingPeriod.analista_id == analista_id
            )
        )
    ).scalar_one_or_none()
    if not cp:
        raise HTTPException(status_code=404, detail="Chilling period não encontrado")
    cp.activo = False
    await db.flush()


# ---------------------------------------------------------------------------
# Blacklist Estabelecimentos
# ---------------------------------------------------------------------------

@router.get("/{analista_id}/blacklist", response_model=list[BlacklistOut])
async def list_blacklist(
    analista_id: int,
    user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BlacklistEstabelecimento)
        .where(BlacklistEstabelecimento.analista_id == analista_id)
        .order_by(BlacklistEstabelecimento.id.desc())
    )
    return result.scalars().all()


@router.post("/{analista_id}/blacklist", response_model=BlacklistOut, status_code=201)
async def create_blacklist(
    analista_id: int,
    body: BlacklistCreate,
    user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    analista = (await db.execute(select(Analista).where(Analista.id == analista_id))).scalar_one_or_none()
    if not analista:
        raise HTTPException(status_code=404, detail="Analista não encontrado")
    bl = BlacklistEstabelecimento(
        analista_id=analista_id,
        estabelecimento_id=body.estabelecimento_id,
        motivo=body.motivo,
        permanente=body.permanente,
        criado_por=user.id,
    )
    db.add(bl)
    await db.flush()
    await db.refresh(bl)
    return bl


@router.delete("/{analista_id}/blacklist/{bl_id}", status_code=204)
async def delete_blacklist(
    analista_id: int,
    bl_id: int,
    user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    bl = (
        await db.execute(
            select(BlacklistEstabelecimento).where(
                BlacklistEstabelecimento.id == bl_id,
                BlacklistEstabelecimento.analista_id == analista_id,
            )
        )
    ).scalar_one_or_none()
    if not bl:
        raise HTTPException(status_code=404, detail="Entrada de blacklist não encontrada")
    await db.delete(bl)
    await db.flush()

