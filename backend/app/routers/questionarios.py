"""Questionários dinâmicos — builder, listagem e submissão de respostas."""

import smtplib
import uuid
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, require_role, tenant_filter
from app.models.client import Cliente
from app.models.questionnaire import Questionario, SubmissaoQuestionario
from app.models.settings import ConfiguracaoSistema
from app.models.study import Estudo
from app.models.user import Utilizador

router = APIRouter()


# ─── Schemas ─────────────────────────────────────────────────────────────────

class QuestionarioCreate(BaseModel):
    estudo_id: int
    nome: str
    json_estrutura: Optional[dict] = None  # {"campos": [...]}


class QuestionarioUpdate(BaseModel):
    nome: Optional[str] = None
    json_estrutura: Optional[dict] = None
    activo: Optional[bool] = None


class SubmissaoCreate(BaseModel):
    visita_id: int
    json_respostas: dict  # {"campo_id": value, ...}


# ─── Questionários ────────────────────────────────────────────────────────────

@router.get("/")
async def listar_questionarios(
    estudo_id: Optional[int] = None,
    locale: Optional[str] = None,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Questionario).order_by(Questionario.id)
    if estudo_id is not None:
        stmt = stmt.where(Questionario.estudo_id == estudo_id)
    tid = tenant_filter(user)
    if tid is not None:
        stmt = (
            stmt
            .join(Estudo, Estudo.id == Questionario.estudo_id)
            .join(Cliente, Cliente.id == Estudo.cliente_id)
            .where(Cliente.tenant_id == tid)
        )
    rows = (await db.execute(stmt)).scalars().all()
    return [_q_out(q, locale) for q in rows]


@router.get("/{qid}")
async def obter_questionario(
    qid: int,
    locale: Optional[str] = None,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = await _get_q_or_404(db, qid, user)
    return _q_out(q, locale)


# ─── Translations ─────────────────────────────────────────────────────────────

class TranslationsUpdate(BaseModel):
    translations_json: dict  # {"en": {"nome": "...", "campos": {"field_id": "..."}}, ...}


@router.put("/{qid}/translations")
async def atualizar_traducoes(
    qid: int,
    body: TranslationsUpdate,
    user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    """8.9 — Save per-locale name + field label translations for a questionnaire."""
    q = await _get_q_or_404(db, qid, user)
    # Merge: keep existing locales, update/add provided ones
    existing = q.translations_json or {}
    existing.update(body.translations_json)
    q.translations_json = existing
    await db.commit()
    await db.refresh(q)
    return _q_out(q)


@router.post("/", status_code=201)
async def criar_questionario(
    body: QuestionarioCreate,
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
    q = Questionario(
        estudo_id=body.estudo_id,
        nome=body.nome,
        json_estrutura=body.json_estrutura or {"campos": []},
        criado_por=user.id,
    )
    db.add(q)
    await db.commit()
    await db.refresh(q)
    return _q_out(q)


@router.put("/{qid}")
async def atualizar_questionario(
    qid: int,
    body: QuestionarioUpdate,
    user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    q = await _get_q_or_404(db, qid, user)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(q, field, value)
    # bump version when estrutura changes
    if body.json_estrutura is not None:
        q.versao = (q.versao or 1) + 1
    await db.commit()
    await db.refresh(q)
    return _q_out(q)


@router.delete("/{qid}", status_code=204)
async def eliminar_questionario(
    qid: int,
    user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    q = await _get_q_or_404(db, qid, user)
    await db.delete(q)
    await db.commit()


# ─── Submissões ───────────────────────────────────────────────────────────────

@router.post("/{qid}/submissoes", status_code=201)
async def submeter_questionario(
    qid: int,
    body: SubmissaoCreate,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = await _get_q_or_404(db, qid, user)
    if not q.activo:
        raise HTTPException(400, "Questionário inactivo")

    # Validate required fields against estrutura
    campos = (q.json_estrutura or {}).get("campos", [])
    for campo in campos:
        if campo.get("obrigatorio") and campo["id"] not in body.json_respostas:
            raise HTTPException(422, f"Campo obrigatório em falta: {campo.get('label', campo['id'])}")

    sub = SubmissaoQuestionario(
        questionario_id=qid,
        visita_id=body.visita_id,
        json_respostas=body.json_respostas,
        submetido_em=datetime.now(tz=timezone.utc),
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return _sub_out(sub)


@router.get("/{qid}/submissoes")
async def listar_submissoes(
    qid: int,
    user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    await _get_q_or_404(db, qid, user)
    rows = (await db.execute(
        select(SubmissaoQuestionario)
        .where(SubmissaoQuestionario.questionario_id == qid)
        .order_by(SubmissaoQuestionario.id.desc())
    )).scalars().all()
    return [_sub_out(s) for s in rows]


# ─── 8A.2 Email Distribution ─────────────────────────────────────────────────

class EmailDistribuicaoCreate(BaseModel):
    emails: list[str]
    assunto: Optional[str] = None
    mensagem: Optional[str] = None


@router.post("/{qid}/enviar-email")
async def enviar_por_email(
    qid: int,
    body: EmailDistribuicaoCreate,
    user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    """8A.2 — Distribute survey link by email using SMTP from system settings."""
    q = await _get_q_or_404(db, qid, user)

    smtp_keys = ["smtp_host", "smtp_port", "smtp_user", "smtp_password", "smtp_from", "app_url"]
    rows = (await db.execute(
        select(ConfiguracaoSistema).where(ConfiguracaoSistema.chave.in_(smtp_keys))
    )).scalars().all()
    cfg = {r.chave: r.valor for r in rows}

    if not cfg.get("smtp_host") or not cfg.get("smtp_user") or not cfg.get("smtp_password"):
        raise HTTPException(
            status_code=422,
            detail="SMTP não configurado. Vai a Configurações → Sistema e define smtp_host, smtp_user e smtp_password.",
        )

    base_url = cfg.get("app_url", "https://q21.otokura.online")
    survey_url = f"{base_url}/questionarios/{qid}/responder"

    assunto = body.assunto or f"Questionário: {q.nome}"
    mensagem_extra = body.mensagem or ""

    sent: list[str] = []
    errors: list[dict] = []

    for addr in body.emails:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = assunto
            msg["From"] = cfg.get("smtp_from") or cfg["smtp_user"]
            msg["To"] = addr

            html = f"""<!DOCTYPE html>
<html><body style="font-family:sans-serif;color:#1e293b;max-width:600px;margin:auto;padding:24px">
<h2 style="color:#4f46e5">Questionário: {q.nome}</h2>
{f'<p>{mensagem_extra}</p>' if mensagem_extra else ''}
<p>Clique no link abaixo para responder ao questionário:</p>
<p><a href="{survey_url}" style="background:#4f46e5;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">Responder ao Questionário</a></p>
<p style="color:#64748b;font-size:12px;margin-top:24px">Este email foi enviado automaticamente pela plataforma Cognira Intelligence.</p>
</body></html>"""

            msg.attach(MIMEText(html, "html"))

            port = int(cfg.get("smtp_port") or 587)
            with smtplib.SMTP(cfg["smtp_host"], port, timeout=10) as smtp:
                smtp.ehlo()
                smtp.starttls()
                smtp.login(cfg["smtp_user"], cfg["smtp_password"])
                smtp.sendmail(msg["From"], [addr], msg.as_string())

            sent.append(addr)
        except Exception as exc:
            errors.append({"email": addr, "erro": str(exc)})

    return {"enviados": len(sent), "emails_enviados": sent, "erros": errors}


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def _get_q_or_404(db: AsyncSession, qid: int, user: Optional[Utilizador] = None) -> Questionario:
    stmt = select(Questionario).where(Questionario.id == qid)
    if user is not None:
        tid = tenant_filter(user)
        if tid is not None:
            stmt = (
                stmt
                .join(Estudo, Estudo.id == Questionario.estudo_id)
                .join(Cliente, Cliente.id == Estudo.cliente_id)
                .where(Cliente.tenant_id == tid)
            )
    q = (await db.execute(stmt)).scalar_one_or_none()
    if q is None:
        raise HTTPException(404, f"Questionário {qid} não encontrado")
    return q


def _q_out(q: Questionario, locale: Optional[str] = None) -> dict:
    """Serialize questionnaire; if locale is provided apply translations."""
    estrutura = q.json_estrutura or {"campos": []}

    if locale and locale != "pt" and q.translations_json:
        t = q.translations_json.get(locale, {})
        nome = t.get("nome") or q.nome
        campos_t = t.get("campos", {})
        if campos_t:
            campos = [
                {**c, "label": campos_t.get(c["id"], c["label"])}
                for c in estrutura.get("campos", [])
            ]
            estrutura = {**estrutura, "campos": campos}
    else:
        nome = q.nome

    return {
        "id": q.id,
        "estudo_id": q.estudo_id,
        "nome": nome,
        "versao": q.versao,
        "activo": q.activo,
        "json_estrutura": estrutura,
        "translations_json": q.translations_json or {},
        "criado_por": str(q.criado_por) if q.criado_por else None,
    }


def _sub_out(s: SubmissaoQuestionario) -> dict:
    return {
        "id": s.id,
        "questionario_id": s.questionario_id,
        "visita_id": s.visita_id,
        "json_respostas": s.json_respostas,
        "submetido_em": s.submetido_em.isoformat() if s.submetido_em else None,
    }
