import math
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, require_role, tenant_filter
from app.models.establishment import Estabelecimento
from app.models.client import Cliente
from app.models.user import Utilizador
from app.schemas import EstabelecimentoCreate, EstabelecimentoOut


# ---------------------------------------------------------------------------
# Route optimisation helpers (pure Python — no extra deps)
# ---------------------------------------------------------------------------

def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _route_distance(route: list, coords: dict) -> float:
    total = 0.0
    for i in range(len(route) - 1):
        a, b = coords[route[i]], coords[route[i + 1]]
        total += _haversine_km(a[0], a[1], b[0], b[1])
    return total


def _two_opt(route: list, coords: dict, max_iter: int = 500) -> list:
    best = route[:]
    improved = True
    iterations = 0
    while improved and iterations < max_iter:
        improved = False
        iterations += 1
        for i in range(1, len(best) - 2):
            for j in range(i + 1, len(best)):
                if j - i == 1:
                    continue
                candidate = best[:i] + best[i:j][::-1] + best[j:]
                if _route_distance(candidate, coords) < _route_distance(best, coords):
                    best = candidate
                    improved = True
    return best


class RouteOptimizeRequest(BaseModel):
    ids: List[int]
    start_lat: Optional[float] = None
    start_lng: Optional[float] = None


class RouteStop(BaseModel):
    id: int
    nome: str
    latitude: Optional[float]
    longitude: Optional[float]


class RouteOptimizeResponse(BaseModel):
    route: List[RouteStop]
    total_km: float
    improvement_pct: float

router = APIRouter()


@router.get("/", response_model=list[EstabelecimentoOut])
async def list_estabelecimentos(
    cliente_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=5000),
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(Estabelecimento)
    tid = tenant_filter(user)
    if tid is not None:
        q = q.join(Cliente, Estabelecimento.cliente_id == Cliente.id).where(Cliente.tenant_id == tid)
    if cliente_id:
        q = q.where(Estabelecimento.cliente_id == cliente_id)
    q = q.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/scores")
async def estabelecimentos_scores(
    estudo_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    _: Utilizador = Depends(get_current_user),
):
    """Return avg pontuacao per estabelecimento_id for geographic heatmap coloring."""
    from sqlalchemy import func as safunc
    from app.models.visit import Visita

    q = (
        select(
            Visita.estabelecimento_id,
            safunc.avg(Visita.pontuacao).label("avg_score"),
        )
        .where(
            Visita.pontuacao.is_not(None),
            Visita.pontuacao_estado == "calculada",
        )
        .group_by(Visita.estabelecimento_id)
    )
    if estudo_id:
        q = q.where(Visita.estudo_id == estudo_id)
    rows = (await db.execute(q)).all()
    return {row.estabelecimento_id: round(float(row.avg_score), 1) for row in rows}


@router.get("/{estab_id}", response_model=EstabelecimentoOut)
async def get_estabelecimento(
    estab_id: int,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(Estabelecimento)
        .join(Cliente, Estabelecimento.cliente_id == Cliente.id)
        .where(Estabelecimento.id == estab_id)
    )
    tid = tenant_filter(user)
    if tid is not None:
        q = q.where(Cliente.tenant_id == tid)
    estab = (await db.execute(q)).scalar_one_or_none()
    if not estab:
        raise HTTPException(status_code=404, detail="Estabelecimento não encontrado")
    return estab


@router.post("/", response_model=EstabelecimentoOut, status_code=201,
             dependencies=[Depends(require_role("admin", "coordenador"))])
async def create_estabelecimento(
    body: EstabelecimentoCreate,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify the parent cliente belongs to the user's tenant
    tid = tenant_filter(user)
    if tid is not None:
        cq = select(Cliente).where(Cliente.id == body.cliente_id, Cliente.tenant_id == tid)
        if not (await db.execute(cq)).scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Cliente não encontrado")
    estab = Estabelecimento(**body.model_dump())
    db.add(estab)
    await db.flush()
    await db.refresh(estab)
    return estab


@router.put("/{estab_id}", response_model=EstabelecimentoOut,
            dependencies=[Depends(require_role("admin", "coordenador"))])
async def update_estabelecimento(
    estab_id: int,
    body: EstabelecimentoCreate,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(Estabelecimento)
        .join(Cliente, Estabelecimento.cliente_id == Cliente.id)
        .where(Estabelecimento.id == estab_id)
    )
    tid = tenant_filter(user)
    if tid is not None:
        q = q.where(Cliente.tenant_id == tid)
    estab = (await db.execute(q)).scalar_one_or_none()
    if not estab:
        raise HTTPException(status_code=404, detail="Estabelecimento não encontrado")
    for k, v in body.model_dump().items():
        setattr(estab, k, v)
    await db.flush()
    await db.refresh(estab)
    return estab


@router.delete("/{estab_id}", status_code=204,
               dependencies=[Depends(require_role("admin", "coordenador"))])
async def delete_estabelecimento(
    estab_id: int,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(Estabelecimento)
        .join(Cliente, Estabelecimento.cliente_id == Cliente.id)
        .where(Estabelecimento.id == estab_id)
    )
    tid = tenant_filter(user)
    if tid is not None:
        q = q.where(Cliente.tenant_id == tid)
    estab = (await db.execute(q)).scalar_one_or_none()
    if not estab:
        raise HTTPException(status_code=404, detail="Estabelecimento não encontrado")
    estab.activo = False
    await db.flush()


# ---------------------------------------------------------------------------
# Route optimisation — POST /estabelecimentos/route-optimize
# ---------------------------------------------------------------------------

@router.post("/route-optimize", response_model=RouteOptimizeResponse)
async def route_optimize(
    body: RouteOptimizeRequest,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if len(body.ids) < 2:
        raise HTTPException(status_code=422, detail="Forneça pelo menos 2 estabelecimentos.")
    if len(body.ids) > 200:
        raise HTTPException(status_code=422, detail="Máximo 200 estabelecimentos por optimização.")

    rq = select(Estabelecimento).where(Estabelecimento.id.in_(body.ids))
    tid = tenant_filter(user)
    if tid is not None:
        rq = rq.join(Cliente, Estabelecimento.cliente_id == Cliente.id).where(Cliente.tenant_id == tid)
    result = await db.execute(rq)
    rows = {e.id: e for e in result.scalars().all()}

    # Filter to only those with valid coordinates
    valid_ids = [i for i in body.ids if i in rows and rows[i].latitude and rows[i].longitude]
    if len(valid_ids) < 2:
        raise HTTPException(status_code=422, detail="Estabelecimentos sem coordenadas suficientes.")

    coords = {i: (rows[i].latitude, rows[i].longitude) for i in valid_ids}

    # Nearest-neighbour seed
    if body.start_lat is not None and body.start_lng is not None:
        start = min(valid_ids, key=lambda i: _haversine_km(body.start_lat, body.start_lng, coords[i][0], coords[i][1]))
    else:
        start = valid_ids[0]

    unvisited = set(valid_ids)
    nn_route = [start]
    unvisited.remove(start)
    while unvisited:
        last = nn_route[-1]
        nearest = min(unvisited, key=lambda i: _haversine_km(coords[last][0], coords[last][1], coords[i][0], coords[i][1]))
        nn_route.append(nearest)
        unvisited.remove(nearest)

    nn_dist = _route_distance(nn_route, coords)
    opt_route = _two_opt(nn_route, coords)
    opt_dist = _route_distance(opt_route, coords)
    improvement = max(0.0, (nn_dist - opt_dist) / nn_dist * 100) if nn_dist > 0 else 0.0

    return RouteOptimizeResponse(
        route=[
            RouteStop(
                id=i,
                nome=rows[i].nome,
                latitude=rows[i].latitude,
                longitude=rows[i].longitude,
            )
            for i in opt_route
        ],
        total_km=round(opt_dist, 2),
        improvement_pct=round(improvement, 1),
    )
