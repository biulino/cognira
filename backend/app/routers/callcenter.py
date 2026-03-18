"""Call-centre router.

Endpoints:
  GET/PUT  /configuracao              — admin: upload permission settings
  GET/POST /templates                 — list & create evaluation templates
  GET/PUT  /templates/{id}            — get & update a template
  POST     /upload                    — submit audio file (202 + bg pipeline)
  GET      /                          — list calls (filterable)
  GET      /{id}                      — call detail (incl. transcript + report)
  GET      /{id}/audio-url            — 15-min presigned MinIO URL
  POST     /{id}/reprocessar          — re-run GPT analysis (keeps transcript)
  POST     /{id}/retranscrever        — re-run full pipeline from scratch
  GET      /{id}/relatorio/pdf        — download PDF report
"""
import os
import re
import uuid
from datetime import datetime
from typing import Any, Optional

from fastapi import (
    APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, UploadFile,
)
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, async_session
from app.deps import get_current_user, require_role, tenant_filter
from app.edition import require_pro
from app.models.callcenter import ChamadaCallCenter, ConfiguracaoCallCenter, TemplateCallCenter
from app.models.client import Cliente
from app.models.user import Utilizador
from app.services import storage
from app.services.callcenter_pipeline import run_pipeline, run_pipeline_analysis_only

router = APIRouter()

VALID_ROLES = {"admin", "coordenador", "validador", "analista", "cliente"}

# ── Pydantic schemas ──────────────────────────────────────────────────────────

class TemplateCreate(BaseModel):
    nome: str
    descricao: Optional[str] = None
    cliente_id: Optional[int] = None
    campos: list[dict]


class TemplateOut(BaseModel):
    id: int
    nome: str
    descricao: Optional[str]
    cliente_id: Optional[int]
    campos: Any
    activo: bool
    criado_em: datetime
    model_config = {"from_attributes": True}


class ChamadaOut(BaseModel):
    id: int
    cliente_id: int
    estudo_id: Optional[int]
    template_id: Optional[int]
    nome_ficheiro: str
    tamanho: Optional[int]
    mime_type: Optional[str]
    duracao_segundos: Optional[int]
    estado: str
    erro_mensagem: Optional[str]
    score_global: Optional[float]
    referencia_externa: Optional[str]
    agente_nome: Optional[str]
    data_chamada: Optional[datetime]
    criado_em: datetime
    model_config = {"from_attributes": True}


class ChamadaDetail(ChamadaOut):
    transcricao: Optional[str]
    dados_extraidos: Optional[Any]
    relatorio: Optional[str]


class ConfiguracaoOut(BaseModel):
    roles_upload: list
    max_ficheiro_mb: int
    model_config = {"from_attributes": True}


class ConfiguracaoUpdate(BaseModel):
    roles_upload: list[str]
    max_ficheiro_mb: int


# ── Audio magic-bytes MIME detection ─────────────────────────────────────────

_MAGIC: list[tuple[bytes, str]] = [
    (b"ID3", "audio/mpeg"),
    (b"\xff\xfb", "audio/mpeg"),
    (b"\xff\xf3", "audio/mpeg"),
    (b"\xff\xf2", "audio/mpeg"),
    (b"RIFF", "audio/wav"),
    (b"OggS", "audio/ogg"),
    (b"fLaC", "audio/flac"),
    (b"\x1a\x45\xdf\xa3", "audio/webm"),
]


def _detect_mime(data: bytes) -> Optional[str]:
    for magic, mime in _MAGIC:
        if data[: len(magic)] == magic:
            return mime
    # M4A / MP4: 'ftyp' atom at offset 4
    if len(data) >= 8 and data[4:8] == b"ftyp":
        return "audio/mp4"
    return None


# ── Config helpers ────────────────────────────────────────────────────────────

async def _get_or_create_config(db: AsyncSession) -> ConfiguracaoCallCenter:
    result = await db.execute(
        select(ConfiguracaoCallCenter).where(ConfiguracaoCallCenter.id == 1)
    )
    config = result.scalar_one_or_none()
    if not config:
        config = ConfiguracaoCallCenter(id=1)
        db.add(config)
        await db.commit()
        await db.refresh(config)
    return config


async def _check_upload_permission(
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Utilizador:
    config = await _get_or_create_config(db)
    if user.role_global not in config.roles_upload:
        raise HTTPException(status_code=403, detail="Sem permissão para submeter chamadas")
    return user


# ── Background task wrappers ──────────────────────────────────────────────────

async def _run_pipeline_bg(chamada_id: int) -> None:
    async with async_session() as db:
        await run_pipeline(chamada_id, db)


async def _run_reprocess_bg(chamada_id: int) -> None:
    async with async_session() as db:
        await run_pipeline_analysis_only(chamada_id, db)


# ── Config endpoints ──────────────────────────────────────────────────────────

@router.get("/configuracao", response_model=ConfiguracaoOut)
async def get_configuracao(
    user: Utilizador = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    return await _get_or_create_config(db)


@router.put("/configuracao", response_model=ConfiguracaoOut)
async def update_configuracao(
    body: ConfiguracaoUpdate,
    user: Utilizador = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    invalid = set(body.roles_upload) - VALID_ROLES
    if invalid:
        raise HTTPException(status_code=400, detail=f"Roles inválidos: {invalid}")
    if not (1 <= body.max_ficheiro_mb <= 500):
        raise HTTPException(
            status_code=400, detail="max_ficheiro_mb deve estar entre 1 e 500"
        )
    config = await _get_or_create_config(db)
    config.roles_upload = body.roles_upload
    config.max_ficheiro_mb = body.max_ficheiro_mb
    await db.commit()
    await db.refresh(config)
    return config


# ── Template endpoints ────────────────────────────────────────────────────────

@router.get("/templates", response_model=list[TemplateOut])
async def list_templates(
    user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TemplateCallCenter).where(TemplateCallCenter.activo.is_(True))
    )
    return result.scalars().all()


@router.post("/templates", response_model=TemplateOut, status_code=201)
async def create_template(
    body: TemplateCreate,
    user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    if not body.campos:
        raise HTTPException(status_code=400, detail="Template deve ter pelo menos um campo")
    tpl = TemplateCallCenter(
        nome=body.nome,
        descricao=body.descricao,
        cliente_id=body.cliente_id,
        campos=body.campos,
    )
    db.add(tpl)
    await db.commit()
    await db.refresh(tpl)
    return tpl


@router.get("/templates/{template_id}", response_model=TemplateOut)
async def get_template(
    template_id: int,
    user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TemplateCallCenter).where(TemplateCallCenter.id == template_id)
    )
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(status_code=404, detail="Template não encontrado")
    return tpl


@router.put("/templates/{template_id}", response_model=TemplateOut)
async def update_template(
    template_id: int,
    body: TemplateCreate,
    user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TemplateCallCenter).where(TemplateCallCenter.id == template_id)
    )
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(status_code=404, detail="Template não encontrado")
    if not body.campos:
        raise HTTPException(status_code=400, detail="Template deve ter pelo menos um campo")
    tpl.nome = body.nome
    tpl.descricao = body.descricao
    tpl.cliente_id = body.cliente_id
    tpl.campos = body.campos
    await db.commit()
    await db.refresh(tpl)
    return tpl


# ── Upload endpoint ───────────────────────────────────────────────────────────

@router.post("/upload", response_model=ChamadaOut, status_code=202)
async def upload_chamada(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    cliente_id: int = Form(...),
    estudo_id: Optional[int] = Form(None),
    template_id: Optional[int] = Form(None),
    referencia_externa: Optional[str] = Form(None),
    agente_nome: Optional[str] = Form(None),
    data_chamada: Optional[str] = Form(None),
    user: Utilizador = Depends(_check_upload_permission),
    db: AsyncSession = Depends(get_db),
):
    require_pro("ai_callcenter")
    config = await _get_or_create_config(db)
    max_bytes = config.max_ficheiro_mb * 1024 * 1024

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Ficheiro vazio")
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Ficheiro demasiado grande. Máximo: {config.max_ficheiro_mb} MB",
        )

    detected_mime = _detect_mime(content)
    if not detected_mime:
        raise HTTPException(
            status_code=400,
            detail="Formato não suportado. Use mp3, wav, m4a, ogg, flac ou webm.",
        )

    parsed_data_chamada: Optional[datetime] = None
    if data_chamada:
        try:
            parsed_data_chamada = datetime.fromisoformat(data_chamada)
        except ValueError:
            raise HTTPException(
                status_code=400, detail="data_chamada inválida — use formato ISO 8601"
            )

    object_name = f"{uuid.uuid4()}/{re.sub(r'[^\\w.\\-]', '_', os.path.basename((file.filename or 'audio').replace('\\\\', '/')))[:200] or 'audio'}"
    try:
        storage.upload_bytes("callcenter-audio", object_name, content, detected_mime)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro ao guardar áudio: {exc}")

    chamada = ChamadaCallCenter(
        cliente_id=cliente_id,
        estudo_id=estudo_id,
        template_id=template_id,
        nome_ficheiro=file.filename or "audio",
        url_minio=object_name,
        tamanho=len(content),
        mime_type=detected_mime,
        referencia_externa=(referencia_externa or "")[:200] or None,
        agente_nome=(agente_nome or "")[:200] or None,
        data_chamada=parsed_data_chamada,
        submetido_por_id=user.id,
        estado="pendente",
    )
    db.add(chamada)
    await db.commit()
    await db.refresh(chamada)

    background_tasks.add_task(_run_pipeline_bg, chamada.id)
    return chamada


# ── List & detail endpoints ───────────────────────────────────────────────────

async def _get_chamada_or_404(
    chamada_id: int,
    user: Utilizador,
    db: AsyncSession,
) -> ChamadaCallCenter:
    """Fetch ChamadaCallCenter by id, scoped to the user's tenant."""
    tid = tenant_filter(user)
    q = select(ChamadaCallCenter).where(ChamadaCallCenter.id == chamada_id)
    if tid is not None:
        q = q.join(Cliente, ChamadaCallCenter.cliente_id == Cliente.id).where(
            Cliente.tenant_id == tid
        )
    chamada = (await db.execute(q)).scalar_one_or_none()
    if not chamada:
        raise HTTPException(status_code=404, detail="Chamada não encontrada")
    return chamada


@router.get("/", response_model=list[ChamadaOut])
async def list_chamadas(
    cliente_id: Optional[int] = None,
    estudo_id: Optional[int] = None,
    estado: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tid = tenant_filter(user)
    q = select(ChamadaCallCenter)
    if tid is not None:
        q = q.join(Cliente, ChamadaCallCenter.cliente_id == Cliente.id).where(
            Cliente.tenant_id == tid
        )
    if cliente_id:
        q = q.where(ChamadaCallCenter.cliente_id == cliente_id)
    if estudo_id:
        q = q.where(ChamadaCallCenter.estudo_id == estudo_id)
    if estado:
        q = q.where(ChamadaCallCenter.estado == estado)
    q = q.order_by(ChamadaCallCenter.id.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/{chamada_id}", response_model=ChamadaDetail)
async def get_chamada(
    chamada_id: int,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _get_chamada_or_404(chamada_id, user, db)


@router.get("/{chamada_id}/audio-url")
async def get_audio_url(
    chamada_id: int,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    chamada = await _get_chamada_or_404(chamada_id, user, db)
    try:
        url = storage.presigned_get_url("callcenter-audio", chamada.url_minio, 900)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar URL de áudio: {exc}")
    return {"url": url, "expires_in": 900}


# ── Reprocessing endpoints ────────────────────────────────────────────────────

@router.post("/{chamada_id}/reprocessar", status_code=202)
async def reprocessar(
    chamada_id: int,
    background_tasks: BackgroundTasks,
    template_id: Optional[int] = None,
    user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    """Re-run GPT extraction + report using existing transcription (no Whisper cost)."""
    require_pro("ai_callcenter")
    chamada = await _get_chamada_or_404(chamada_id, user, db)
    if not chamada.transcricao:
        raise HTTPException(
            status_code=422,
            detail="Sem transcrição disponível. Use /retranscrever para iniciar do início.",
        )
    if chamada.estado in ("transcrevendo", "a_analisar"):
        raise HTTPException(status_code=409, detail="Chamada já está a ser processada")

    if template_id:
        chamada.template_id = template_id
    chamada.estado = "pendente"
    chamada.erro_mensagem = None
    chamada.dados_extraidos = None
    chamada.relatorio = None
    chamada.score_global = None
    await db.commit()

    background_tasks.add_task(_run_reprocess_bg, chamada_id)
    return {"detail": "Reprocessamento iniciado"}


@router.post("/{chamada_id}/retranscrever", status_code=202)
async def retranscrever(
    chamada_id: int,
    background_tasks: BackgroundTasks,
    user: Utilizador = Depends(require_role("admin", "coordenador")),
    db: AsyncSession = Depends(get_db),
):
    """Re-run full pipeline including a fresh Whisper transcription."""
    require_pro("ai_callcenter")
    chamada = await _get_chamada_or_404(chamada_id, user, db)
    if chamada.estado in ("transcrevendo", "a_analisar"):
        raise HTTPException(status_code=409, detail="Chamada já está a ser processada")

    chamada.estado = "pendente"
    chamada.erro_mensagem = None
    chamada.transcricao = None
    chamada.dados_extraidos = None
    chamada.relatorio = None
    chamada.score_global = None
    await db.commit()

    background_tasks.add_task(_run_pipeline_bg, chamada_id)
    return {"detail": "Retranscrição iniciada"}


# ── PDF export ────────────────────────────────────────────────────────────────

@router.get("/{chamada_id}/relatorio/pdf")
async def export_pdf(
    chamada_id: int,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    chamada = await _get_chamada_or_404(chamada_id, user, db)
    if chamada.estado != "concluido":
        raise HTTPException(status_code=422, detail="Relatório ainda não disponível")
    try:
        pdf_bytes = _build_pdf(chamada)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar PDF: {exc}")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'attachment; filename="relatorio_chamada_{chamada_id}.pdf"'
            )
        },
    )


def _build_pdf(chamada: ChamadaCallCenter) -> bytes:
    from fpdf import FPDF  # lazy import — only when needed

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, f"Relatório de Chamada #{chamada.id}", ln=True)
    pdf.set_font("Helvetica", "", 11)
    pdf.ln(2)

    def row(label: str, value: str) -> None:
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(55, 7, label, ln=False)
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(0, 7, value, ln=True)

    row("Referência:", chamada.referencia_externa or "—")
    row("Agente:", chamada.agente_nome or "—")
    if chamada.data_chamada:
        row("Data:", chamada.data_chamada.strftime("%d/%m/%Y %H:%M"))
    if chamada.score_global is not None:
        row("Score Global:", f"{chamada.score_global:.1f}%")

    if chamada.dados_extraidos:
        pdf.ln(4)
        pdf.set_font("Helvetica", "B", 13)
        pdf.cell(0, 8, "Dados Extraídos", ln=True)
        pdf.set_font("Helvetica", "", 10)
        for k, v in chamada.dados_extraidos.items():
            if not k.startswith("_"):
                pdf.multi_cell(0, 6, f"  {k}: {v}")

    if chamada.relatorio:
        pdf.ln(4)
        pdf.set_font("Helvetica", "B", 13)
        pdf.cell(0, 8, "Relatório Narrativo", ln=True)
        pdf.set_font("Helvetica", "", 10)
        clean = (
            chamada.relatorio
            .replace("**", "")
            .replace("## ", "")
            .replace("# ", "")
            .replace("* ", "  \u2022 ")
        )
        for line in clean.split("\n"):
            pdf.multi_cell(0, 6, line)

    return bytes(pdf.output())
