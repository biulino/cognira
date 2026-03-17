"""
/api/chat-interno — real-time polling-based internal chat.

GET  /nao-lidas                       — total unread across all conversations
GET  /utilizadores                    — list users (for starting chat)
GET  /conversas                       — my conversations (with unread count)
POST /conversas/direto                — start or get 1:1 conversation
POST /conversas/grupo                 — admin: create named group
GET  /conversas/{cid}/mensagens       — messages (?desde=ISO to fetch only new)
POST /conversas/{cid}/mensagens       — send message (auto-marks read)
PUT  /conversas/{cid}/ler             — mark conversation as read
POST /conversas/{cid}/membros         — admin: add member to group
DELETE /conversas/{cid}/membros/{uid} — admin: remove member from group
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, and_, case, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, tenant_filter
from app.models.chat import Conversa, ConversaMembro, ChatMensagem
from app.models.user import Utilizador

router = APIRouter()

# ── Schemas ───────────────────────────────────────────────────────────────────

class DirectoBody(BaseModel):
    utilizador_id: uuid.UUID


class GrupoBody(BaseModel):
    nome: str
    membros: list[uuid.UUID]   # must include at least 1 other user


class MensagemBody(BaseModel):
    texto: str


class MembroBody(BaseModel):
    utilizador_id: uuid.UUID


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _membro_ou_403(cid: int, user_id: uuid.UUID, db: AsyncSession) -> ConversaMembro:
    row = (await db.execute(
        select(ConversaMembro).where(
            ConversaMembro.conversa_id == cid,
            ConversaMembro.utilizador_id == user_id,
        )
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(403, "Não és membro desta conversa")
    return row


async def _serialize_conversa(conv: Conversa, me_id: uuid.UUID, db: AsyncSession) -> dict:
    membros_rows = (await db.execute(
        select(ConversaMembro, Utilizador)
        .join(Utilizador, ConversaMembro.utilizador_id == Utilizador.id)
        .where(ConversaMembro.conversa_id == conv.id)
    )).all()

    membros = [
        {"id": str(u.id), "username": u.username, "role": u.role_global}
        for _, u in membros_rows
    ]

    # Last message
    last_msg = (await db.execute(
        select(ChatMensagem)
        .where(ChatMensagem.conversa_id == conv.id)
        .order_by(ChatMensagem.criada_em.desc())
        .limit(1)
    )).scalar_one_or_none()

    # Unread count (messages after my last-read, not sent by me)
    my_membro = next((m for m, _ in membros_rows if m.utilizador_id == me_id), None)
    if my_membro and my_membro.ultimo_lido_em:
        unread = (await db.execute(
            select(func.count()).where(
                ChatMensagem.conversa_id == conv.id,
                ChatMensagem.remetente_id != me_id,
                ChatMensagem.criada_em > my_membro.ultimo_lido_em,
            )
        )).scalar_one()
    else:
        unread = (await db.execute(
            select(func.count()).where(
                ChatMensagem.conversa_id == conv.id,
                ChatMensagem.remetente_id != me_id,
            )
        )).scalar_one()

    # Display name for 1:1
    nome = conv.nome
    if conv.tipo == "direto" and not nome:
        other = next((u for m, u in membros_rows if u.id != me_id), None)
        nome = other.username if other else "Conversa"

    return {
        "id": conv.id,
        "nome": nome,
        "tipo": conv.tipo,
        "ultimo_msg": last_msg.texto if last_msg else None,
        "ultimo_msg_de": None,  # enriched below for 1:1
        "ultimo_msg_em": last_msg.criada_em.isoformat() if last_msg else None,
        "unread": unread,
        "membros": membros,
    }


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/nao-lidas")
async def nao_lidas(
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Total unread messages across all conversations."""
    from sqlalchemy import case, literal_column
    from sqlalchemy.orm import aliased

    cm = aliased(ConversaMembro)
    msg = aliased(ChatMensagem)

    # Single aggregate query: join memberships with messages, count unread
    q = (
        select(func.coalesce(func.sum(literal_column("1")), 0))
        .select_from(cm)
        .join(msg, and_(
            msg.conversa_id == cm.conversa_id,
            msg.remetente_id != user.id,
        ))
        .where(
            cm.utilizador_id == user.id,
            # Only count messages newer than ultimo_lido_em (or all if null)
            case(
                (cm.ultimo_lido_em.is_not(None), msg.criada_em > cm.ultimo_lido_em),
                else_=True,
            ),
        )
    )
    total = (await db.execute(q)).scalar_one()
    return {"count": int(total)}


@router.get("/utilizadores")
async def listar_utilizadores(
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Utilizador)
        .where(Utilizador.activo == True, Utilizador.id != user.id)  # noqa: E712
        .order_by(Utilizador.role_global, Utilizador.username)
    )
    tid = tenant_filter(user)
    if tid is not None:
        stmt = stmt.where(Utilizador.tenant_id == tid)
    users = (await db.execute(stmt)).scalars().all()
    return [{"id": str(u.id), "username": u.username, "role": u.role_global} for u in users]


@router.get("/conversas")
async def listar_conversas(
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conv_ids = (await db.execute(
        select(ConversaMembro.conversa_id).where(ConversaMembro.utilizador_id == user.id)
    )).scalars().all()

    if not conv_ids:
        return []

    convs = (await db.execute(
        select(Conversa)
        .where(Conversa.id.in_(conv_ids))
        .order_by(Conversa.criada_em.desc())
    )).scalars().all()

    result = []
    for conv in convs:
        result.append(await _serialize_conversa(conv, user.id, db))

    # Sort by last message time desc
    result.sort(key=lambda x: x["ultimo_msg_em"] or "0000", reverse=True)
    return result


@router.post("/conversas/direto", status_code=201)
async def criar_ou_obter_direto(
    body: DirectoBody,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    dest = (await db.execute(
        select(Utilizador).where(Utilizador.id == body.utilizador_id, Utilizador.activo == True)  # noqa: E712
    )).scalar_one_or_none()
    if not dest:
        raise HTTPException(404, "Utilizador não encontrado")
    if dest.id == user.id:
        raise HTTPException(400, "Não podes criar chat contigo próprio")

    # Find existing 1:1 conversation between the two users
    my_convs = (await db.execute(
        select(ConversaMembro.conversa_id).where(ConversaMembro.utilizador_id == user.id)
    )).scalars().all()

    dest_convs = (await db.execute(
        select(ConversaMembro.conversa_id).where(ConversaMembro.utilizador_id == dest.id)
    )).scalars().all()

    common = set(my_convs) & set(dest_convs)
    if common:
        # Check if any is a 'direto' type
        existing = (await db.execute(
            select(Conversa).where(Conversa.id.in_(common), Conversa.tipo == "direto")
        )).scalars().first()
        if existing:
            return await _serialize_conversa(existing, user.id, db)

    # Create new 1:1 conversation
    conv = Conversa(tipo="direto", criado_por=user.id, nome=None)
    db.add(conv)
    await db.flush()

    db.add(ConversaMembro(conversa_id=conv.id, utilizador_id=user.id))
    db.add(ConversaMembro(conversa_id=conv.id, utilizador_id=dest.id))
    await db.commit()
    await db.refresh(conv)

    return await _serialize_conversa(conv, user.id, db)


@router.post("/conversas/grupo", status_code=201)
async def criar_grupo(
    body: GrupoBody,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role_global not in ("admin", "coordenador"):
        raise HTTPException(403, "Apenas admin/coordenador pode criar grupos")
    if not body.nome.strip():
        raise HTTPException(400, "Nome do grupo é obrigatório")

    conv = Conversa(tipo="grupo", nome=body.nome.strip(), criado_por=user.id)
    db.add(conv)
    await db.flush()

    # Add creator + all specified members
    member_ids = {user.id} | set(body.membros)
    for uid in member_ids:
        db.add(ConversaMembro(conversa_id=conv.id, utilizador_id=uid))

    await db.commit()
    await db.refresh(conv)
    return await _serialize_conversa(conv, user.id, db)


@router.get("/conversas/{cid}/mensagens")
async def get_mensagens(
    cid: int,
    desde: Optional[str] = Query(None, description="ISO timestamp — return only messages after this"),
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _membro_ou_403(cid, user.id, db)

    q = select(ChatMensagem, Utilizador).join(
        Utilizador, ChatMensagem.remetente_id == Utilizador.id
    ).where(ChatMensagem.conversa_id == cid)

    if desde:
        try:
            ts = datetime.fromisoformat(desde.replace("Z", "+00:00"))
            q = q.where(ChatMensagem.criada_em > ts)
        except ValueError:
            pass

    q = q.order_by(ChatMensagem.criada_em.asc()).limit(100)
    rows = (await db.execute(q)).all()

    return [
        {
            "id": msg.id,
            "conversa_id": msg.conversa_id,
            "remetente_id": str(msg.remetente_id),
            "remetente_username": u.username,
            "texto": msg.texto,
            "criada_em": msg.criada_em.isoformat(),
        }
        for msg, u in rows
    ]


@router.post("/conversas/{cid}/mensagens", status_code=201)
async def enviar_mensagem(
    cid: int,
    body: MensagemBody,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _membro_ou_403(cid, user.id, db)

    if not body.texto.strip():
        raise HTTPException(400, "Mensagem vazia")

    msg = ChatMensagem(
        conversa_id=cid,
        remetente_id=user.id,
        texto=body.texto.strip(),
    )
    db.add(msg)

    # Auto-mark as read for sender
    membro = (await db.execute(
        select(ConversaMembro).where(
            ConversaMembro.conversa_id == cid,
            ConversaMembro.utilizador_id == user.id,
        )
    )).scalar_one_or_none()
    if membro:
        membro.ultimo_lido_em = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(msg)

    # Real-time: notify all other conversation members
    try:
        from app.ws import manager
        _uids_q = await db.execute(
            select(ConversaMembro.utilizador_id).where(ConversaMembro.conversa_id == cid)
        )
        _other_ids = [str(uid) for uid in _uids_q.scalars().all() if uid != user.id]
        await manager.broadcast_to_users(
            _other_ids,
            {"evento": "chat_msg", "conversa_id": cid, "remetente_id": str(user.id)},
        )
    except Exception:
        pass

    return {"id": msg.id, "criada_em": msg.criada_em.isoformat()}


@router.put("/conversas/{cid}/ler")
async def marcar_lido(
    cid: int,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    membro = await _membro_ou_403(cid, user.id, db)
    membro.ultimo_lido_em = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True}


@router.post("/conversas/{cid}/membros", status_code=201)
async def adicionar_membro(
    cid: int,
    body: MembroBody,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role_global not in ("admin", "coordenador"):
        raise HTTPException(403, "Apenas admin/coordenador pode gerir membros")

    conv = (await db.execute(select(Conversa).where(Conversa.id == cid))).scalar_one_or_none()
    if not conv:
        raise HTTPException(404, "Conversa não encontrada")
    if conv.tipo != "grupo":
        raise HTTPException(400, "Só grupos podem ter membros adicionados")

    novo = (await db.execute(
        select(Utilizador).where(Utilizador.id == body.utilizador_id)
    )).scalar_one_or_none()
    if not novo:
        raise HTTPException(404, "Utilizador não encontrado")

    db.add(ConversaMembro(conversa_id=cid, utilizador_id=body.utilizador_id))
    await db.commit()
    return {"ok": True}


@router.delete("/conversas/{cid}/membros/{uid}", status_code=204)
async def remover_membro(
    cid: int,
    uid: uuid.UUID,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role_global not in ("admin", "coordenador"):
        raise HTTPException(403, "Apenas admin/coordenador pode gerir membros")

    await db.execute(
        delete(ConversaMembro).where(
            ConversaMembro.conversa_id == cid,
            ConversaMembro.utilizador_id == uid,
        )
    )
    await db.commit()
