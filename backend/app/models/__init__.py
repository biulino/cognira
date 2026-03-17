# Import all models so Alembic and SQLAlchemy can discover them
from app.models.base import Base  # noqa: F401

from app.models.user import Utilizador, PermissaoEstudo  # noqa: F401
from app.models.client import Cliente, PortalCliente  # noqa: F401
from app.models.study import Estudo, Onda, FiltroEstudo  # noqa: F401
from app.models.analyst import (  # noqa: F401
    Analista,
    CandidaturaRecrutamento,
    ChillingPeriod,
    BlacklistEstabelecimento,
)
from app.models.establishment import Estabelecimento  # noqa: F401
from app.models.visit import (  # noqa: F401
    Visita,
    CampoVisita,
    CaracterizacaoCache,
    CandidaturaVisita,
)
from app.models.photo import TipoVisitaConfig, FotoVisita  # noqa: F401
from app.models.evaluation import Grelha, SecaoGrelha, CriterioGrelha, RespostaVisita  # noqa: F401
from app.models.questionnaire import Questionario, SubmissaoQuestionario  # noqa: F401
from app.models.training import (  # noqa: F401
    Formacao,
    TesteFormacao,
    ResultadoFormacao,
    CertificacaoAnalista,
)
from app.models.payment import (  # noqa: F401
    TabelaValores,
    PagamentoVisita,
    ExportacaoFinanceira,
    OrcamentoEstudo,
)
from app.models.message import MensagemVisita, MensagemSistema  # noqa: F401
from app.models.action import ThresholdAcao, PlanoAcao  # noqa: F401
from app.models.compliance import (  # noqa: F401
    NotificacaoVisita,
    AuditLog,
    ConsentimentoRgpd,
    RetencaoDados,
)
from app.models.callcenter import (  # noqa: F401
    TemplateCallCenter,
    ChamadaCallCenter,
    ConfiguracaoCallCenter,
)
from app.models.settings import ConfiguracaoSistema  # noqa: F401
from app.models.chat import Conversa, ConversaMembro, ChatMensagem  # noqa: F401
from app.models.chat_sessao import ChatSessao  # noqa: F401
from app.models.webhook import ApiKey, WebhookSubscription, WebhookDelivery  # noqa: F401
from app.models.push import PushSubscription  # noqa: F401
from app.models.modulo import ClienteModulo  # noqa: F401
from app.models.shelf_audit import ShelfAuditItem  # noqa: F401
from app.models.planogram import Planogram, PlanogramComparacao  # noqa: F401
from app.models.tenant import Tenant, PlanoTenant  # noqa: F401
