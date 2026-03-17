import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, require_role, tenant_filter
from app.models.user import Utilizador, PermissaoEstudo
from app.models.analyst import Analista
from app.schemas import UtilizadorOut
from app.services.audit import log_action
from app.services import pii

router = APIRouter()

VALID_ROLES = {"admin", "utilizador", "coordenador", "validador", "analista", "cliente"}
VALID_PERMISSAO_ROLES = {"coordenador", "analista", "validador", "cliente"}


class RoleUpdate(BaseModel):
    role_global: str


class UtilizadorCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role_global: str = "utilizador"


class PermissaoCreate(BaseModel):
    estudo_id: int
    role: str


class PermissaoOut(BaseModel):
    id: uuid.UUID
    utilizador_id: uuid.UUID
    estudo_id: int
    role: str

    model_config = {"from_attributes": True}


@router.get("/", response_model=list[UtilizadorOut])
async def list_utilizadores(
    user: Utilizador = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    q = select(Utilizador).order_by(Utilizador.criado_em.desc())
    tid = tenant_filter(user)
    if tid is not None:
        q = q.where(Utilizador.tenant_id == tid)
    result = await db.execute(q)
    return result.scalars().all()


@router.put("/{user_id}/toggle", response_model=UtilizadorOut)
async def toggle_utilizador(
    user_id: uuid.UUID,
    user: Utilizador = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    q = select(Utilizador).where(Utilizador.id == user_id)
    tid = tenant_filter(user)
    if tid is not None:
        q = q.where(Utilizador.tenant_id == tid)
    result = await db.execute(q)
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")
    if target.id == user.id:
        raise HTTPException(
            status_code=400, detail="Não podes desactivar a tua própria conta"
        )
    target.activo = not target.activo
    await log_action(
        db,
        utilizador_id=user.id,
        entidade="Utilizador",
        entidade_id=str(target.id),
        acao="toggle_activo",
        dados_novos={"activo": target.activo, "username": target.username},
    )
    await db.flush()
    await db.refresh(target)
    return target


@router.put("/{user_id}/role", response_model=UtilizadorOut)
async def change_role(
    user_id: uuid.UUID,
    body: RoleUpdate,
    user: Utilizador = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    if body.role_global not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="Role inválida")
    q = select(Utilizador).where(Utilizador.id == user_id)
    tid = tenant_filter(user)
    if tid is not None:
        q = q.where(Utilizador.tenant_id == tid)
    result = await db.execute(q)
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")
    target.role_global = body.role_global
    await log_action(
        db,
        utilizador_id=user.id,
        entidade="Utilizador",
        entidade_id=str(target.id),
        acao="change_role",
        dados_novos={"role_global": body.role_global, "username": target.username},
    )
    await db.flush()
    await db.refresh(target)
    return target


@router.post("/", response_model=UtilizadorOut, status_code=201)
async def create_utilizador(
    body: UtilizadorCreate,
    user: Utilizador = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    from app.auth.jwt import hash_password
    from app.services import pii
    from sqlalchemy import func

    if body.role_global not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="Role inválida")

    # Plan limit enforcement
    if user.tenant and user.tenant.plano and user.tenant.plano.max_utilizadores is not None:
        tid = user.tenant_id
        count = (await db.execute(
            select(func.count(Utilizador.id)).where(
                Utilizador.tenant_id == tid,
                Utilizador.activo.is_(True),
            )
        )).scalar() or 0
        if count >= user.tenant.plano.max_utilizadores:
            raise HTTPException(status_code=402, detail=f"Limite de utilizadores do plano atingido ({user.tenant.plano.max_utilizadores}).")

    # Check duplicates
    dup = await db.execute(select(Utilizador).where(Utilizador.username == body.username))
    if dup.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Username já existe")

    new_user = Utilizador(
        username=body.username,
        email=pii.encrypt(body.email),
        password_hash=hash_password(body.password),
        role_global=body.role_global,
        activo=True,
        tenant_id=user.tenant_id,
    )
    db.add(new_user)
    await db.flush()
    await db.refresh(new_user)
    await log_action(
        db,
        utilizador_id=user.id,
        entidade="Utilizador",
        entidade_id=str(new_user.id),
        acao="create",
        dados_novos={"username": new_user.username, "role_global": new_user.role_global},
    )
    await db.commit()
    await db.refresh(new_user)
    return new_user


@router.delete("/{user_id}", status_code=204)
async def delete_utilizador(
    user_id: uuid.UUID,
    user: Utilizador = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Utilizador).where(Utilizador.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")
    if target.id == user.id:
        raise HTTPException(status_code=400, detail="Não podes eliminar a tua própria conta")
    # Soft-delete: deactivate instead of hard delete
    target.activo = False
    await log_action(
        db,
        utilizador_id=user.id,
        entidade="Utilizador",
        entidade_id=str(target.id),
        acao="delete",
        dados_novos={"username": target.username},
    )
    await db.commit()


@router.get("/{user_id}", response_model=UtilizadorOut)
async def get_utilizador(
    user_id: uuid.UUID,
    user: Utilizador = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Utilizador).where(Utilizador.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")
    return target


# ── Permissões por estudo ─────────────────────────────────────────────────────

@router.get("/{user_id}/permissoes", response_model=list[PermissaoOut])
async def list_permissoes(
    user_id: uuid.UUID,
    user: Utilizador = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PermissaoEstudo).where(PermissaoEstudo.utilizador_id == user_id)
    )
    return result.scalars().all()


@router.post("/{user_id}/permissoes", response_model=PermissaoOut, status_code=201)
async def add_permissao(
    user_id: uuid.UUID,
    body: PermissaoCreate,
    user: Utilizador = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    if body.role not in VALID_PERMISSAO_ROLES:
        raise HTTPException(status_code=400, detail=f"Role inválida. Use: {', '.join(VALID_PERMISSAO_ROLES)}")

    target = (await db.execute(select(Utilizador).where(Utilizador.id == user_id))).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")

    # Upsert: remove existing permission for same study
    existing = await db.execute(
        select(PermissaoEstudo).where(
            PermissaoEstudo.utilizador_id == user_id,
            PermissaoEstudo.estudo_id == body.estudo_id,
        )
    )
    old = existing.scalar_one_or_none()
    if old:
        old.role = body.role
        await db.commit()
        await db.refresh(old)
        return old

    perm = PermissaoEstudo(
        utilizador_id=user_id,
        estudo_id=body.estudo_id,
        role=body.role,
    )
    db.add(perm)
    await db.commit()
    await db.refresh(perm)
    return perm


@router.delete("/{user_id}/permissoes/{perm_id}", status_code=204)
async def remove_permissao(
    user_id: uuid.UUID,
    perm_id: uuid.UUID,
    user: Utilizador = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PermissaoEstudo).where(
            PermissaoEstudo.id == perm_id,
            PermissaoEstudo.utilizador_id == user_id,
        )
    )
    perm = result.scalar_one_or_none()
    if not perm:
        raise HTTPException(status_code=404, detail="Permissão não encontrada")
    await db.delete(perm)
    await db.commit()


# ── RGPD Art.20 — Export pessoal de dados ─────────────────────────────
@router.get("/{user_id}/export-data", summary="RGPD Art.20 — Exportar dados pessoais")
async def export_user_data(
    user_id: uuid.UUID,
    requestor: Utilizador = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns all personal data held for a user (Art.20 data portability).
    Only the user themselves or a platform admin may call this."""
    if str(requestor.id) != str(user_id) and requestor.role_global != "admin" and not requestor.is_superadmin:
        raise HTTPException(403, "Apenas o próprio utilizador ou um administrador pode exportar dados.")

    target = (await db.execute(select(Utilizador).where(Utilizador.id == user_id))).scalar_one_or_none()
    if not target:
        raise HTTPException(404, "Utilizador não encontrado")

    # Collect linked analyst profile
    analista = (await db.execute(
        select(Analista).where(Analista.utilizador_id == user_id)
    )).scalar_one_or_none()

    # Collect study permissions
    perms = (await db.execute(
        select(PermissaoEstudo).where(PermissaoEstudo.utilizador_id == user_id)
    )).scalars().all()

    await log_action(db, str(requestor.id), "rgpd_export", "utilizadores", str(user_id), {})

    return JSONResponse(content={
        "export_date": datetime.now(timezone.utc).isoformat(),
        "utilizador": {
            "id": str(target.id),
            "username": target.username,
            "email": pii.decrypt(target.email) if target.email else None,
            "role_global": target.role_global,
            "activo": target.activo,
            "tenant_id": target.tenant_id,
            "cliente_id": target.cliente_id,
            "criado_em": target.criado_em.isoformat() if getattr(target, 'criado_em', None) else None,
        },
        "perfil_analista": {
            "id": analista.id,
            "nome": pii.decrypt(analista.nome) if analista and analista.nome else None,
            "email": pii.decrypt(analista.email) if analista and analista.email else None,
            "telefone": pii.decrypt(analista.telefone) if analista and analista.telefone else None,
            "nif": pii.decrypt(analista.nif) if analista and analista.nif else None,
            "morada": pii.decrypt(analista.morada) if analista and analista.morada else None,
            "data_nascimento": pii.decrypt(analista.data_nascimento) if analista and analista.data_nascimento else None,
        } if analista else None,
        "permissoes_estudo": [
            {"estudo_id": p.estudo_id, "role": p.role} for p in perms
        ],
    })


# ── RGPD Art.17 — Direito ao apagamento (anonimização) ───────────────────
@router.post("/{user_id}/anonimizar", status_code=200, summary="RGPD Art.17 — Anonimizar dados pessoais")
async def anonimizar_utilizador(
    user_id: uuid.UUID,
    admin: Utilizador = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Irreversibly anonymises all personal data for a user (Art.17 right to erasure).
    Keeps aggregate records (visits, scores) with a synthetic anonymous identifier.
    Only admins may call this."""
    tid = tenant_filter(admin)
    target = (await db.execute(
        select(Utilizador).where(
            Utilizador.id == user_id,
            *([Utilizador.tenant_id == tid] if tid else []),
        )
    )).scalar_one_or_none()
    if not target:
        raise HTTPException(404, "Utilizador não encontrado")
    if target.is_superadmin:
        raise HTTPException(403, "Não é possível anonimizar um superadmin.")

    anon_tag = f"anon_{str(user_id)[:8]}"

    # Anonymise Utilizador
    target.username = anon_tag
    target.email = pii.encrypt(f"{anon_tag}@anonimizado.invalid")
    target.password_hash = "!ANON"
    target.totp_secret = None
    target.totp_activo = False
    target.backup_codes = None
    target.sso_id = None
    target.activo = False

    # Anonymise linked Analista profile
    analista = (await db.execute(
        select(Analista).where(Analista.utilizador_id == user_id)
    )).scalar_one_or_none()
    if analista:
        analista.nome = pii.encrypt(anon_tag)
        analista.email = pii.encrypt(f"{anon_tag}@anonimizado.invalid")
        analista.telefone = None
        analista.nif = None
        analista.morada = None
        analista.data_nascimento = None

    await db.commit()
    await log_action(db, str(admin.id), "rgpd_anonimizar", "utilizadores", str(user_id), {"anon_tag": anon_tag})

    return {"status": "anonimizado", "anon_tag": anon_tag}
