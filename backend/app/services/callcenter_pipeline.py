"""Call-centre AI pipeline.

Stages:
  1. Download audio from MinIO
  2. Transcribe with Whisper (whisper-1, PT-PT)
  3. Extract structured data with GPT-4.1 using the client's template
  4. Generate a narrative quality report with GPT-4.1

run_pipeline()              — full pipeline (used on fresh upload)
run_pipeline_analysis_only() — re-run stages 3+4 using existing transcription
                               (cheaper: no Whisper call)
"""
import io
import json
import logging
from typing import Optional

from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.callcenter import ChamadaCallCenter, TemplateCallCenter
from app.services.storage import download_bytes

settings = get_settings()
logger = logging.getLogger(__name__)

_WHISPER_LIMIT_BYTES = 24 * 1024 * 1024  # 24 MB — Whisper API hard limit is 25 MB

_MIME_TO_EXT: dict[str, str] = {
    "audio/mpeg": "mp3",
    "audio/mp4": "mp4",
    "audio/x-m4a": "m4a",
    "audio/wav": "wav",
    "audio/wave": "wav",
    "audio/x-wav": "wav",
    "audio/ogg": "ogg",
    "audio/webm": "webm",
    "audio/flac": "flac",
}

_EXTRACTION_SYS = (
    "És um analista de qualidade de call center especializado em Portugal.\n"
    "Recebeste a transcrição de uma chamada e um conjunto de critérios de avaliação.\n"
    "Extrai APENAS os dados pedidos no schema fornecido.\n"
    "Responde SEMPRE em JSON válido, sem texto adicional, seguindo o schema exactamente.\n"
    "Para campos booleanos usa true/false. Para escalas numéricas usa o valor numérico. "
    "Para campos de texto usa string vazia se não aplicável."
)

_REPORT_SYS = (
    "És um analista sénior de qualidade de call center em Portugal.\n"
    "Recebeste a transcrição de uma chamada e os dados de avaliação estruturados.\n"
    "Gera um relatório executivo completo em português de Portugal com as seguintes secções:\n\n"
    "## Resumo da Chamada\n(2-3 frases descrevendo contexto e resultado)\n\n"
    "## Pontos Fortes\n(comportamentos positivos identificados)\n\n"
    "## Pontos de Melhoria\n(comportamentos que requerem atenção)\n\n"
    "## Avaliação por Dimensão\n(análise de cada critério avaliado)\n\n"
    "## Score Global\n(percentagem final com justificação)\n\n"
    "Usa linguagem profissional e objectiva. Formato Markdown."
)


# ── Public API ────────────────────────────────────────────────────────────────

async def run_pipeline(chamada_id: int, db: AsyncSession) -> None:
    """Full pipeline: Whisper STT → structured extraction → narrative report."""
    oai = await _get_routed_client("transcription", db)
    if not oai:
        await _set_error(chamada_id, "OPENAI_API_KEY não configurada.", db)
        return

    chamada = await _load(chamada_id, db)
    if not chamada:
        return

    template = (
        await _load_template(chamada.template_id, db) if chamada.template_id else None
    )

    # ── Stage 1: Transcription ────────────────────────────────────────────────
    chamada.estado = "transcrevendo"
    await db.commit()

    try:
        audio_bytes = download_bytes("callcenter-audio", chamada.url_minio)
    except Exception as exc:
        await _set_error(chamada_id, f"Erro ao ler áudio do storage: {exc}", db)
        return

    if len(audio_bytes) > _WHISPER_LIMIT_BYTES:
        await _set_error(
            chamada_id,
            f"Ficheiro demasiado grande ({len(audio_bytes) // 1024 // 1024} MB > 24 MB). "
            "Converte para MP3 a 64 kbps e submete novamente.",
            db,
        )
        return

    ext = _MIME_TO_EXT.get(chamada.mime_type or "", "mp3")
    audio_fp = io.BytesIO(audio_bytes)
    audio_fp.name = f"audio.{ext}"

    try:
        transcript = await oai.audio.transcriptions.create(
            model="whisper-1",
            file=audio_fp,
            language="pt",
            response_format="text",
        )
        transcricao = str(transcript).strip()
    except Exception as exc:
        await _set_error(chamada_id, f"Erro na transcrição (Whisper): {exc}", db)
        return

    chamada.transcricao = transcricao
    chamada.estado = "a_analisar"
    await db.commit()

    # ── Stages 2+3: extraction + report ──────────────────────────────────────
    await _run_analysis(chamada_id, transcricao, template, oai, db)


async def run_pipeline_analysis_only(chamada_id: int, db: AsyncSession) -> None:
    """Re-run extraction + report using existing transcription (no Whisper cost)."""
    oai = await _get_routed_client("scoring", db)
    if not oai:
        await _set_error(chamada_id, "OPENAI_API_KEY não configurada.", db)
        return

    chamada = await _load(chamada_id, db)
    if not chamada or not chamada.transcricao:
        await _set_error(chamada_id, "Sem transcrição disponível para reprocessar.", db)
        return

    template = (
        await _load_template(chamada.template_id, db) if chamada.template_id else None
    )
    chamada.estado = "a_analisar"
    await db.commit()

    await _run_analysis(chamada_id, chamada.transcricao, template, oai, db)


# ── Internal helpers ──────────────────────────────────────────────────────────

def _get_client() -> Optional[AsyncOpenAI]:
    """Return a default OpenAI client from the env key (sync, used as fallback)."""
    if not settings.openai_api_key:
        return None
    return AsyncOpenAI(api_key=settings.openai_api_key)


async def _get_routed_client(task: str, db: AsyncSession) -> Optional[AsyncOpenAI]:
    """Return the best available client for the given task via provider routing.

    Falls back to env key if provider routing is not configured.
    """
    from app.ai.provider_factory import get_client_for_task
    routed, _ = await get_client_for_task(task, db)
    return routed or _get_client()


async def _load(chamada_id: int, db: AsyncSession) -> Optional[ChamadaCallCenter]:
    result = await db.execute(
        select(ChamadaCallCenter).where(ChamadaCallCenter.id == chamada_id)
    )
    return result.scalar_one_or_none()


async def _load_template(
    template_id: int, db: AsyncSession
) -> Optional[TemplateCallCenter]:
    result = await db.execute(
        select(TemplateCallCenter).where(TemplateCallCenter.id == template_id)
    )
    return result.scalar_one_or_none()


async def _run_analysis(
    chamada_id: int,
    transcricao: str,
    template: Optional[TemplateCallCenter],
    oai: AsyncOpenAI,
    db: AsyncSession,
) -> None:
    dados_extraidos: dict = {}
    score_global: Optional[float] = None

    # ── Stage 2: Structured extraction ───────────────────────────────────────
    if template and template.campos:
        schema_json = json.dumps(template.campos, ensure_ascii=False, indent=2)
        prompt = (
            f"Schema de extracção:\n{schema_json}\n\n"
            f"Transcrição da chamada:\n{transcricao}"
        )
        try:
            resp = await oai.chat.completions.create(
                model="gpt-4.1",
                messages=[
                    {"role": "system", "content": _EXTRACTION_SYS},
                    {"role": "user", "content": prompt},
                ],
                temperature=0,
                response_format={"type": "json_object"},
            )
            raw = resp.choices[0].message.content or "{}"
            dados_extraidos = json.loads(raw)
            if "score_global" in dados_extraidos:
                try:
                    score_global = float(dados_extraidos["score_global"])
                except (ValueError, TypeError):
                    pass
        except Exception as exc:
            logger.warning("Extracção estruturada falhou para chamada %s: %s", chamada_id, exc)
            dados_extraidos = {"_erro_extracao": str(exc)}

    # ── Stage 3: Narrative report ─────────────────────────────────────────────
    campos_str = (
        json.dumps(dados_extraidos, ensure_ascii=False, indent=2)
        if dados_extraidos
        else "Sem template definido — avaliação qualitativa apenas."
    )
    report_prompt = (
        f"Transcrição da chamada:\n{transcricao}\n\n"
        f"Dados de avaliação:\n{campos_str}\n\nGera o relatório."
    )
    try:
        rep = await oai.chat.completions.create(
            model="gpt-4.1",
            messages=[
                {"role": "system", "content": _REPORT_SYS},
                {"role": "user", "content": report_prompt},
            ],
            temperature=0.3,
        )
        relatorio = rep.choices[0].message.content or ""
    except Exception as exc:
        logger.warning("Geração de relatório falhou para chamada %s: %s", chamada_id, exc)
        relatorio = f"Erro ao gerar relatório: {exc}"

    # ── Persist results ───────────────────────────────────────────────────────
    chamada = await _load(chamada_id, db)
    if chamada:
        chamada.dados_extraidos = dados_extraidos or None
        chamada.relatorio = relatorio
        chamada.score_global = score_global
        chamada.estado = "concluido"
        chamada.erro_mensagem = None
        await db.commit()
        # Real-time: notify the user who uploaded the recording
        if chamada.submetido_por_id:
            try:
                from app.ws import manager
                await manager.send_personal(
                    str(chamada.submetido_por_id),
                    {"evento": "callcenter_concluido", "chamada_id": chamada_id, "estado": "concluido"},
                )
            except Exception:
                pass


async def _set_error(chamada_id: int, msg: str, db: AsyncSession) -> None:
    chamada = await _load(chamada_id, db)
    if chamada:
        chamada.estado = "erro"
        chamada.erro_mensagem = msg
        await db.commit()
        # Real-time: notify uploader
        if chamada.submetido_por_id:
            try:
                from app.ws import manager
                await manager.send_personal(
                    str(chamada.submetido_por_id),
                    {"evento": "callcenter_concluido", "chamada_id": chamada_id, "estado": "erro"},
                )
            except Exception:
                pass
