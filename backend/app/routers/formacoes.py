"""Formações (training modules) and certificações router."""

from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, require_role, tenant_filter
from app.models.client import Cliente
from app.models.study import Estudo
from app.models.training import (
    CertificacaoAnalista,
    Formacao,
    ResultadoFormacao,
    TesteFormacao,
)
from app.models.user import Utilizador

router = APIRouter()

# ─── Schemas ─────────────────────────────────────────────────────────────────


class FormacaoCreate(BaseModel):
    estudo_id: int
    titulo: str
    conteudo_html: Optional[str] = None
    documento_url_minio: Optional[str] = None
    obrigatoria: bool = True


class FormacaoUpdate(BaseModel):
    titulo: Optional[str] = None
    conteudo_html: Optional[str] = None
    documento_url_minio: Optional[str] = None
    obrigatoria: Optional[bool] = None


class ResultadoCreate(BaseModel):
    analista_id: int
    pontuacao_obtida: int
    aprovado: bool
    tentativa: int = 1
    realizado_em: Optional[datetime] = None


class CertificacaoCreate(BaseModel):
    estudo_id: int
    certificado_em: Optional[date] = None
    valido_ate: Optional[date] = None
    estado: str = "activo"


# ─── Formações endpoints ──────────────────────────────────────────────────────


@router.get("/")
async def listar_formacoes(
    estudo_id: Optional[int] = None,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all training modules, optionally filtered by study."""
    stmt = select(Formacao).order_by(Formacao.id)
    if estudo_id is not None:
        stmt = stmt.where(Formacao.estudo_id == estudo_id)
    tid = tenant_filter(user)
    if tid is not None:
        stmt = (
            stmt
            .join(Estudo, Estudo.id == Formacao.estudo_id)
            .join(Cliente, Cliente.id == Estudo.cliente_id)
            .where(Cliente.tenant_id == tid)
        )
    rows = (await db.execute(stmt)).scalars().all()
    return [_formacao_out(f) for f in rows]


@router.get("/{formacao_id}")
async def obter_formacao(
    formacao_id: int,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    f = await _get_formacao_or_404(db, formacao_id, user)
    return _formacao_out(f)


@router.post("/", status_code=201)
async def criar_formacao(
    body: FormacaoCreate,
    user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    tid = tenant_filter(user)
    if tid is not None:
        estudo = (
            await db.execute(
                select(Estudo)
                .join(Cliente, Cliente.id == Estudo.cliente_id)
                .where(Estudo.id == body.estudo_id, Cliente.tenant_id == tid)
            )
        ).scalar_one_or_none()
        if not estudo:
            raise HTTPException(404, "Estudo não encontrado")
    f = Formacao(**body.model_dump())
    db.add(f)
    await db.commit()
    await db.refresh(f)
    return _formacao_out(f)


@router.put("/{formacao_id}")
async def atualizar_formacao(
    formacao_id: int,
    body: FormacaoUpdate,
    user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    f = await _get_formacao_or_404(db, formacao_id, user)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(f, field, value)
    await db.commit()
    await db.refresh(f)
    return _formacao_out(f)


@router.delete("/{formacao_id}", status_code=204)
async def eliminar_formacao(
    formacao_id: int,
    user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    f = await _get_formacao_or_404(db, formacao_id, user)
    await db.delete(f)
    await db.commit()


# ─── Test questions ───────────────────────────────────────────────────────────


@router.get("/{formacao_id}/testes")
async def listar_testes(
    formacao_id: int,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_formacao_or_404(db, formacao_id, user)
    rows = (
        await db.execute(
            select(TesteFormacao).where(TesteFormacao.formacao_id == formacao_id)
        )
    ).scalars().all()
    return [_teste_out(t) for t in rows]


# ─── Resultados ───────────────────────────────────────────────────────────────


@router.get("/{formacao_id}/resultados")
async def listar_resultados(
    formacao_id: int,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all analyst results for a training module (admin/coordenador view)."""
    if user.role_global not in ("admin", "coordenador"):
        raise HTTPException(403, "Acesso negado")
    await _get_formacao_or_404(db, formacao_id, user)
    rows = (
        await db.execute(
            select(ResultadoFormacao)
            .where(ResultadoFormacao.formacao_id == formacao_id)
            .order_by(ResultadoFormacao.realizado_em.desc())
        )
    ).scalars().all()
    return [_resultado_out(r) for r in rows]


@router.post("/{formacao_id}/resultados", status_code=201)
async def registar_resultado(
    formacao_id: int,
    body: ResultadoCreate,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_formacao_or_404(db, formacao_id, user)
    r = ResultadoFormacao(formacao_id=formacao_id, **body.model_dump())
    db.add(r)
    await db.commit()
    await db.refresh(r)
    return _resultado_out(r)


# ─── Certificações per analista ───────────────────────────────────────────────


@router.get("/analistas/{analista_id}/certificacoes")
async def listar_certificacoes(
    analista_id: int,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(CertificacaoAnalista)
            .where(CertificacaoAnalista.analista_id == analista_id)
            .order_by(CertificacaoAnalista.certificado_em.desc())
        )
    ).scalars().all()
    return [_cert_out(c) for c in rows]


@router.post("/analistas/{analista_id}/certificacoes", status_code=201, dependencies=[Depends(require_role("admin", "coordenador"))])
async def adicionar_certificacao(
    analista_id: int,
    body: CertificacaoCreate,
    db: AsyncSession = Depends(get_db),
):
    c = CertificacaoAnalista(analista_id=analista_id, **body.model_dump())
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return _cert_out(c)


@router.delete("/certificacoes/{cert_id}", status_code=204, dependencies=[Depends(require_role("admin", "coordenador"))])
async def remover_certificacao(
    cert_id: int,
    db: AsyncSession = Depends(get_db),
):
    c = await _get_or_404(db, CertificacaoAnalista, cert_id)
    await db.delete(c)
    await db.commit()


# ─── Helpers ─────────────────────────────────────────────────────────────────


async def _get_formacao_or_404(db: AsyncSession, formacao_id: int, user: Utilizador) -> Formacao:
    stmt = select(Formacao).where(Formacao.id == formacao_id)
    tid = tenant_filter(user)
    if tid is not None:
        stmt = (
            stmt
            .join(Estudo, Estudo.id == Formacao.estudo_id)
            .join(Cliente, Cliente.id == Estudo.cliente_id)
            .where(Cliente.tenant_id == tid)
        )
    f = (await db.execute(stmt)).scalar_one_or_none()
    if f is None:
        raise HTTPException(404, f"Formação {formacao_id} não encontrada")
    return f


async def _get_or_404(db: AsyncSession, model, pk: int):
    obj = (await db.execute(select(model).where(model.id == pk))).scalar_one_or_none()
    if obj is None:
        raise HTTPException(404, f"{model.__tablename__} {pk} não encontrado")
    return obj


def _formacao_out(f: Formacao) -> dict:
    return {
        "id": f.id,
        "estudo_id": f.estudo_id,
        "titulo": f.titulo,
        "conteudo_html": f.conteudo_html,
        "documento_url_minio": f.documento_url_minio,
        "obrigatoria": f.obrigatoria,
    }


def _teste_out(t: TesteFormacao) -> dict:
    return {
        "id": t.id,
        "formacao_id": t.formacao_id,
        "pergunta": t.pergunta,
        "opcoes": t.opcoes,
        "resposta_correta_idx": t.resposta_correta_idx,
        "pontuacao": t.pontuacao,
    }


def _resultado_out(r: ResultadoFormacao) -> dict:
    return {
        "id": r.id,
        "analista_id": r.analista_id,
        "formacao_id": r.formacao_id,
        "pontuacao_obtida": r.pontuacao_obtida,
        "aprovado": r.aprovado,
        "tentativa": r.tentativa,
        "realizado_em": r.realizado_em.isoformat() if r.realizado_em else None,
    }


def _cert_out(c: CertificacaoAnalista) -> dict:
    return {
        "id": c.id,
        "analista_id": c.analista_id,
        "estudo_id": c.estudo_id,
        "certificado_em": c.certificado_em.isoformat() if c.certificado_em else None,
        "valido_ate": c.valido_ate.isoformat() if c.valido_ate else None,
        "estado": c.estado,
    }
