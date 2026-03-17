import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


# ── Auth ─────────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str


class TOTPVerifyRequest(BaseModel):
    username: str
    code: str = Field(min_length=6, max_length=6)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    requires_2fa: bool = False


class RefreshRequest(BaseModel):
    refresh_token: str


class TOTPSetupResponse(BaseModel):
    qr_png_base64: str
    backup_codes: list[str]


# ── Utilizador ───────────────────────────────────────────
class UtilizadorCreate(BaseModel):
    username: str = Field(min_length=3, max_length=100)
    email: EmailStr
    password: str = Field(min_length=12)
    role_global: str = "utilizador"


class UtilizadorOut(BaseModel):
    id: uuid.UUID
    username: str
    email: str
    role_global: str
    totp_activo: bool
    activo: bool
    criado_em: datetime

    model_config = {"from_attributes": True}

    @field_validator("email", mode="before")
    @classmethod
    def decode_bytes(cls, v: object) -> object:
        if isinstance(v, (bytes, bytearray)):
            from app.services import pii
            return pii.decrypt(bytes(v))
        return v


# ── Cliente ──────────────────────────────────────────────
class ClienteCreate(BaseModel):
    nome: str = Field(max_length=200)
    sla_visita_dias: Optional[int] = None
    sla_validacao_dias: Optional[int] = None


class ClienteOut(BaseModel):
    id: int
    nome: str
    activo: bool
    sla_visita_dias: Optional[int] = 3
    sla_validacao_dias: Optional[int] = 2

    model_config = {"from_attributes": True}


# ── Estudo ───────────────────────────────────────────────
class EstudoCreate(BaseModel):
    cliente_id: int
    nome: str = Field(max_length=300)
    tipo_caracterizacao: Optional[dict] = None


class EstudoOut(BaseModel):
    id: int
    cliente_id: int
    nome: str
    estado: str
    tipo_caracterizacao: Optional[dict] = None
    criado_em: datetime
    total_visitas: int = 0

    model_config = {"from_attributes": True}


# ── Onda ─────────────────────────────────────────────────
class OndaCreate(BaseModel):
    estudo_id: int
    label: str = Field(max_length=100)


class OndaOut(BaseModel):
    id: int
    estudo_id: int
    label: str

    model_config = {"from_attributes": True}


# ── Estabelecimento ──────────────────────────────────────
class EstabelecimentoCreate(BaseModel):
    cliente_id: int
    nome: str = Field(max_length=300)
    id_loja_externo: Optional[str] = None
    tipo_canal: Optional[str] = None
    regiao: Optional[str] = None
    responsavel: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    morada: Optional[str] = None


class EstabelecimentoOut(BaseModel):
    id: int
    cliente_id: int
    nome: str
    id_loja_externo: Optional[str] = None
    tipo_canal: Optional[str] = None
    regiao: Optional[str] = None
    responsavel: Optional[str] = None
    activo: bool
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    morada: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Analista ─────────────────────────────────────────────
class AnalistaCreate(BaseModel):
    nome: str
    email: EmailStr
    codigo_externo: Optional[str] = None
    telefone: Optional[str] = None
    nif: Optional[str] = None
    iban: Optional[str] = None
    morada: Optional[str] = None
    data_nascimento: Optional[str] = None


class AnalistaOut(BaseModel):
    id: int
    nome: Optional[str] = None
    email: Optional[str] = None
    codigo_externo: Optional[str] = None
    telefone: Optional[str] = None
    nif: Optional[str] = None
    iban: Optional[str] = None
    morada: Optional[str] = None
    data_nascimento: Optional[str] = None
    activo: bool
    data_recrutamento: Optional[str] = None

    model_config = {"from_attributes": True}

    @field_validator("nome", "email", "telefone", "nif", "iban", "morada", "data_nascimento", mode="before")
    @classmethod
    def decrypt_pii(cls, v: object) -> object:
        """Decrypt Fernet-encrypted PII bytes; falls back to plain UTF-8 for legacy records."""
        if isinstance(v, (bytes, bytearray)):
            from app.services import pii
            return pii.decrypt(bytes(v))
        return v

    @field_validator("data_recrutamento", mode="before")
    @classmethod
    def format_date(cls, v: object) -> object:
        if v is None:
            return None
        if hasattr(v, "isoformat"):
            return v.isoformat()
        return str(v)


# ── Visita ───────────────────────────────────────────────
class VisitaCreate(BaseModel):
    estudo_id: int
    estabelecimento_id: int
    analista_id: Optional[int] = None
    onda_id: Optional[int] = None
    tipo_visita: str = "normal"
    grelha_id: Optional[int] = None
    planeada_em: Optional[datetime] = None


class VisitaEstadoUpdate(BaseModel):
    estado: str
    motivo_anulacao: Optional[str] = None


class VisitaOut(BaseModel):
    id: int
    estudo_id: int
    analista_id: Optional[int] = None
    analista_nome: Optional[str] = None
    analista_codigo: Optional[str] = None
    estabelecimento_id: int
    estabelecimento_nome: Optional[str] = None
    onda_id: Optional[int] = None
    onda_label: Optional[str] = None
    estado: str
    motivo_anulacao: Optional[str] = None
    tipo_visita: str
    planeada_em: Optional[datetime] = None
    realizada_inicio: Optional[datetime] = None
    realizada_fim: Optional[datetime] = None
    inserida_em: Optional[datetime] = None
    validada_em: Optional[datetime] = None
    pontuacao: Optional[float] = None
    pontuacao_estado: str
    ia_veredicto: Optional[str] = None
    ia_mensagem: Optional[str] = None
    ia_critica_em: Optional[datetime] = None
    activo: bool
    grelha_id: Optional[int] = None
    grelha_nome: Optional[str] = None
    caracterizacao: Optional[dict] = None
    fotos_count: int = 0

    model_config = {"from_attributes": True}


class VisitaListResponse(BaseModel):
    items: list[VisitaOut]
    total: int
    page: int
    page_size: int


# ── VisitaStats ──────────────────────────────────────────
class VisitaStats(BaseModel):
    total: int
    por_estado: dict[str, int]
    pontuacao_media: Optional[float]


# ── Pagamento ────────────────────────────────────────────
class PagamentoCreate(BaseModel):
    visita_id: int
    analista_id: int
    valor_base: float
    valor_despesas: float = 0


class PagamentoOut(BaseModel):
    id: int
    visita_id: int
    analista_id: int
    valor_base: float
    valor_despesas: float
    valor_total: float
    estado: str
    pago_em: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── Chat ─────────────────────────────────────────────────
class ChatRequest(BaseModel):
    mensagem: str = Field(min_length=1, max_length=2000)
    estudo_id: Optional[int] = None
    session_id: Optional[str] = None  # UUID string; creates new session if omitted


class ChatResponse(BaseModel):
    resposta: str
    session_id: str = ""  # UUID of the session — persist on client
    sql_executado: Optional[str] = None
    sugestoes: list[str] = []
    logistica_preview: Optional[dict] = None  # set when a write-op preview is returned


# ── Ingest ───────────────────────────────────────────────
class IngestPreview(BaseModel):
    linhas_novas: int
    linhas_actualizadas: int
    erros: list[str]


# ── Logística IA ─────────────────────────────────────────
class LogisticaPreviewReq(BaseModel):
    mensagem: str = Field(min_length=1, max_length=1000)


class LogisticaExecReq(BaseModel):
    analista_origem_id: int
    analista_destino_id: int
    estudo_id: Optional[int] = None
    visita_ids: Optional[list[int]] = None  # se preenchido, só estas visitas são reatribuídas


# ── Mensagens Sistema ────────────────────────────────────
class MensagemCreate(BaseModel):
    destinatario_id: uuid.UUID
    assunto: str = Field(min_length=1, max_length=200)
    corpo: str = Field(min_length=1)


# ── Chilling Periods ─────────────────────────────────────
from datetime import date as _date

class ChillingPeriodCreate(BaseModel):
    estabelecimento_id: int
    meses: int = Field(ge=1, le=36)
    inicio_em: _date
    fim_em: _date

class ChillingPeriodOut(BaseModel):
    id: int
    analista_id: int
    estabelecimento_id: int
    meses: int
    inicio_em: _date
    fim_em: _date
    activo: bool
    model_config = {"from_attributes": True}

# ── Blacklist Estabelecimentos ────────────────────────────
class BlacklistCreate(BaseModel):
    estabelecimento_id: int
    motivo: Optional[str] = None
    permanente: bool = False

class BlacklistOut(BaseModel):
    id: int
    analista_id: int
    estabelecimento_id: int
    motivo: Optional[str] = None
    permanente: bool
    criado_em: Optional[datetime] = None
    model_config = {"from_attributes": True}

# ── Generic Pagination ───────────────────────────────────
class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int


# ── Grelha / Secao / Criterio ────────────────────────────
class CriterioGrelhaCreate(BaseModel):
    label: str
    peso: Optional[float] = None
    tipo: str = "boolean"   # boolean/escala/texto
    ordem: int = 0


class CriterioGrelhaOut(BaseModel):
    id: int
    grelha_id: int
    secao_id: Optional[int] = None
    label: str
    peso: Optional[float] = None
    tipo: str
    ordem: int
    model_config = {"from_attributes": True}


class SecaoGrelhaCreate(BaseModel):
    nome: str
    ordem: int = 0
    peso_secao: Optional[float] = None
    criterios: list[CriterioGrelhaCreate] = []


class SecaoGrelhaOut(BaseModel):
    id: int
    grelha_id: int
    nome: str
    ordem: int
    peso_secao: Optional[float] = None
    criterios: list[CriterioGrelhaOut] = []
    model_config = {"from_attributes": True}


class GrelhaCreate(BaseModel):
    nome: str
    versao: int = 1
    tipo_visita: Optional[str] = None   # presencial/drive_through/telefonica/auditoria/digital/normal
    secoes: list[SecaoGrelhaCreate] = []


class GrelhaOut(BaseModel):
    id: int
    estudo_id: int
    nome: str
    versao: int
    tipo_visita: Optional[str] = None
    secoes: list[SecaoGrelhaOut] = []
    model_config = {"from_attributes": True}


# ── Shelf Audit (Wave 5 — Retail Audit) ───────────────────────────────────────

class ShelfAuditItemCreate(BaseModel):
    visita_id: int
    produto_nome: str
    ean: Optional[str] = None
    preco_esperado: Optional[float] = None
    preco_real: Optional[float] = None
    quantidade_esperada: Optional[int] = None
    quantidade_real: Optional[int] = None
    facings: Optional[int] = None
    validade: Optional[datetime] = None  # stored as date, accepted as datetime
    conforme: bool = True
    notas: Optional[str] = None


class ShelfAuditItemOut(ShelfAuditItemCreate):
    id: int
    criado_em: datetime
    atualizado_em: datetime
    model_config = {"from_attributes": True}

