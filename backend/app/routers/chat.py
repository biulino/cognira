import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.chat_sessao import ChatSessao
from app.models.user import Utilizador
from app.schemas import ChatRequest, ChatResponse, LogisticaPreviewReq, LogisticaExecReq
from app.ai.agent import run_chat, run_logistica_preview, run_logistica_execute

router = APIRouter()

# Maximum messages kept in a session (older ones are trimmed)
_MAX_SESSION_MSGS = 100
# How many messages the agent receives as context
_CONTEXT_WINDOW = 12


async def _load_or_create_session(
    session_id: str | None, user: Utilizador, db: AsyncSession
) -> ChatSessao:
    """Load existing session (owned by user) or create a new one."""
    if session_id:
        try:
            sid = uuid.UUID(session_id)
            result = await db.execute(
                select(ChatSessao).where(
                    ChatSessao.id == sid,
                    ChatSessao.user_id == user.id,
                )
            )
            existing = result.scalar_one_or_none()
            if existing:
                return existing
        except (ValueError, Exception):
            pass
    sessao = ChatSessao(user_id=user.id, mensagens=[])
    db.add(sessao)
    await db.flush()  # assign UUID
    return sessao


@router.post("", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sessao = await _load_or_create_session(body.session_id, user, db)

    # Pass last N messages as history to the agent (plain dicts)
    historico = [
        {"role": m["role"], "content": m["content"]}
        for m in sessao.mensagens[-_CONTEXT_WINDOW:]
        if m.get("role") in ("user", "assistant")
    ]

    result = await run_chat(body.mensagem, body.estudo_id, user, db, historico=historico)

    # Append new turn to session
    now = datetime.now(timezone.utc).isoformat()
    new_msgs = list(sessao.mensagens) + [
        {"role": "user", "content": body.mensagem, "ts": now},
        {"role": "assistant", "content": result.resposta, "ts": now},
    ]
    # sqlalchemy-json-patch: reassign column to trigger dirty tracking
    sessao.mensagens = new_msgs[-_MAX_SESSION_MSGS:]
    sessao.atualizado_em = datetime.now(timezone.utc)
    await db.commit()

    return ChatResponse(
        resposta=result.resposta,
        session_id=str(sessao.id),
        sugestoes=result.sugestoes,
        logistica_preview=result.logistica_preview,
    )


@router.get("/sessao/{session_id}")
async def get_sessao(
    session_id: str,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return message history for a session owned by the current user."""
    try:
        sid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(400, "session_id inválido")
    result = await db.execute(
        select(ChatSessao).where(ChatSessao.id == sid, ChatSessao.user_id == user.id)
    )
    sessao = result.scalar_one_or_none()
    if not sessao:
        raise HTTPException(404, "Sessão não encontrada")
    return {"session_id": str(sessao.id), "mensagens": sessao.mensagens}


@router.delete("/sessao/{session_id}", status_code=204)
async def delete_sessao(
    session_id: str,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reset (clear) a session's message history."""
    try:
        sid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(400, "session_id inválido")
    result = await db.execute(
        select(ChatSessao).where(ChatSessao.id == sid, ChatSessao.user_id == user.id)
    )
    sessao = result.scalar_one_or_none()
    if not sessao:
        raise HTTPException(404, "Sessão não encontrada")
    sessao.mensagens = []
    sessao.atualizado_em = datetime.now(timezone.utc)
    await db.commit()


@router.post("/logistica/preview")
async def logistica_preview(
    body: LogisticaPreviewReq,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role_global not in ("admin", "coordenador"):
        raise HTTPException(403, "Apenas admin e coordenador podem usar Logística IA")
    return await run_logistica_preview(body.mensagem, db)


@router.post("/logistica/executa")
async def logistica_executa(
    body: LogisticaExecReq,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role_global not in ("admin", "coordenador"):
        raise HTTPException(403, "Apenas admin e coordenador podem usar Logística IA")
    return await run_logistica_execute(
        body.analista_origem_id,
        body.analista_destino_id,
        body.estudo_id,
        db,
        visita_ids=body.visita_ids,
    )
