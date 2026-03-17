import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, require_role, tenant_filter
from app.models.message import MensagemSistema
from app.models.user import Utilizador
from app.schemas import MensagemCreate

router = APIRouter()


@router.get("/nao-lidas")
async def nao_lidas(
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count = (
        await db.execute(
            select(func.count()).where(
                MensagemSistema.destinatario_id == user.id,
                MensagemSistema.lida == False,  # noqa: E712
            )
        )
    ).scalar_one()
    return {"count": count}


@router.get("/utilizadores")
async def listar_utilizadores(
    user: Utilizador = Depends(require_role("admin", "coordenador", "validador")),
    db: AsyncSession = Depends(get_db),
):
    """Return all active users (excluding self) so coordinator can pick a recipient."""
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


@router.get("/enviadas")
async def enviadas(
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(MensagemSistema)
            .where(MensagemSistema.remetente_id == user.id)
            .order_by(MensagemSistema.criada_em.desc())
            .limit(50)
        )
    ).scalars().all()

    result = []
    for m in rows:
        dest = (
            await db.execute(select(Utilizador).where(Utilizador.id == m.destinatario_id))
        ).scalar_one_or_none()
        result.append(
            {
                "id": m.id,
                "remetente_id": str(m.remetente_id),
                "destinatario_id": str(m.destinatario_id),
                "destinatario_username": dest.username if dest else "?",
                "assunto": m.assunto,
                "corpo": m.corpo,
                "lida": m.lida,
                "criada_em": m.criada_em.isoformat(),
            }
        )
    return result


@router.get("/")
async def inbox(
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(MensagemSistema)
            .where(MensagemSistema.destinatario_id == user.id)
            .order_by(MensagemSistema.criada_em.desc())
            .limit(50)
        )
    ).scalars().all()

    result = []
    for m in rows:
        rem = (
            await db.execute(select(Utilizador).where(Utilizador.id == m.remetente_id))
        ).scalar_one_or_none()
        result.append(
            {
                "id": m.id,
                "remetente_id": str(m.remetente_id),
                "remetente_username": rem.username if rem else "?",
                "destinatario_id": str(m.destinatario_id),
                "assunto": m.assunto,
                "corpo": m.corpo,
                "lida": m.lida,
                "criada_em": m.criada_em.isoformat(),
            }
        )
    return result


@router.post("/", status_code=201)
async def enviar(
    body: MensagemCreate,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    dest = (
        await db.execute(select(Utilizador).where(Utilizador.id == body.destinatario_id))
    ).scalar_one_or_none()
    if not dest:
        raise HTTPException(404, "Destinatário não encontrado")
    if not dest.activo:
        raise HTTPException(400, "Destinatário está inactivo")

    msg = MensagemSistema(
        remetente_id=user.id,
        destinatario_id=body.destinatario_id,
        assunto=body.assunto,
        corpo=body.corpo,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)

    # Real-time: notify recipient
    try:
        from app.ws import manager
        await manager.send_personal(
            str(body.destinatario_id),
            {"evento": "mensagem_nova", "id": msg.id, "assunto": body.assunto},
        )
    except Exception:
        pass

    # Web Push notification to recipient
    try:
        import asyncio
        from app.services.push_service import send_push
        asyncio.create_task(send_push(
            user_id=str(body.destinatario_id),
            title=f"Nova mensagem: {body.assunto}",
            body=body.corpo[:120] if body.corpo else "",
            url="/mensagens",
            db=db,
        ))
    except Exception:
        pass

    return {"id": msg.id, "criada_em": msg.criada_em.isoformat()}


@router.put("/{msg_id}/lida")
async def marcar_lida(
    msg_id: int,
    user: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    msg = (
        await db.execute(
            select(MensagemSistema).where(
                MensagemSistema.id == msg_id,
                MensagemSistema.destinatario_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if not msg:
        raise HTTPException(404, "Mensagem não encontrada")
    msg.lida = True
    await db.commit()
    return {"ok": True}
