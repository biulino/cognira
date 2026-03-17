from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.visit import Visita
from app.models.user import Utilizador, PermissaoEstudo

# ── State machine transitions (estado_atual → {novo_estado: [roles permitidos]}) ──
TRANSITIONS: dict[str, dict[str, list[str]]] = {
    "nova": {"planeada": ["admin", "coordenador"]},
    "planeada": {
        "inserida": ["admin", "coordenador", "analista"],
        "anulada": ["admin", "coordenador"],
    },
    "inserida": {
        "corrigir": ["admin", "coordenador", "validador"],
        "corrigir_email": ["admin", "coordenador", "validador"],
        "validada": ["admin", "coordenador", "validador"],
        "para_alteracao": ["admin", "coordenador"],
        "situacao_especial": ["admin", "coordenador"],
        "sem_alteracoes": ["admin", "coordenador"],
        "anulada": ["admin", "coordenador"],
    },
    "corrigir": {
        "corrigida": ["admin", "coordenador", "analista"],
        "anulada": ["admin", "coordenador"],
    },
    "corrigir_email": {
        "corrigida": ["admin", "coordenador", "analista"],
        "anulada": ["admin", "coordenador"],
    },
    "corrigida": {
        "validada": ["admin", "coordenador", "validador"],
        "corrigir": ["admin", "coordenador", "validador"],
        "anulada": ["admin", "coordenador"],
    },
    "validada": {
        "fechada": ["admin", "coordenador"],
        "anulada": ["admin", "coordenador"],
    },
    "para_alteracao": {
        "inserida": ["admin", "coordenador", "analista"],
        "anulada": ["admin", "coordenador"],
    },
    "situacao_especial": {
        "inserida": ["admin", "coordenador"],
        "anulada": ["admin", "coordenador"],
    },
    "sem_alteracoes": {
        "inserida": ["admin", "coordenador"],
        "anulada": ["admin", "coordenador"],
    },
}


async def _get_user_role_for_study(user: Utilizador, estudo_id: int, db: AsyncSession) -> str:
    if user.role_global == "admin":
        return "admin"
    result = await db.execute(
        select(PermissaoEstudo.role).where(
            PermissaoEstudo.utilizador_id == user.id,
            PermissaoEstudo.estudo_id == estudo_id,
        )
    )
    role = result.scalar_one_or_none()
    if role is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sem acesso a este estudo")
    return role


async def transition_visita(
    visita: Visita,
    novo_estado: str,
    user: Utilizador,
    db: AsyncSession,
    motivo_anulacao: Optional[str] = None,
) -> Visita:
    """Apply state transition with RBAC validation."""
    estado_actual = visita.estado

    # Check transition exists
    possiveis = TRANSITIONS.get(estado_actual)
    if not possiveis or novo_estado not in possiveis:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Transição {estado_actual} → {novo_estado} não permitida",
        )

    # Check role
    user_role = await _get_user_role_for_study(user, visita.estudo_id, db)
    roles_permitidos = possiveis[novo_estado]
    if user_role not in roles_permitidos:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Role '{user_role}' não pode fazer {estado_actual} → {novo_estado}",
        )

    # Apply transition
    visita.estado = novo_estado

    if novo_estado == "anulada":
        if not motivo_anulacao:
            raise HTTPException(status_code=400, detail="Motivo de anulação obrigatório")
        visita.motivo_anulacao = motivo_anulacao

    if novo_estado == "validada":
        visita.validada_em = datetime.now(timezone.utc)
        visita.validador_id = user.id

    if novo_estado == "inserida" and visita.inserida_em is None:
        visita.inserida_em = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(visita)
    return visita
