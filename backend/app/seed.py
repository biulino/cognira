"""Comprehensive deterministic demo seed for realistic client and AI testing."""

import asyncio
import random
import uuid
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import select, text as sa_text

from app.auth.jwt import hash_password
from app.database import async_session, engine
from app.models import (
    AuditLog,
    Analista,
    Base,
    BlacklistEstabelecimento,
    CampoVisita,
    CandidaturaRecrutamento,
    CandidaturaVisita,
    CaracterizacaoCache,
    CertificacaoAnalista,
    ChamadaCallCenter,
    ChatMensagem,
    ChatSessao,
    ChillingPeriod,
    Cliente,
    ConfiguracaoCallCenter,
    ConfiguracaoSistema,
    ConsentimentoRgpd,
    Conversa,
    ConversaMembro,
    CriterioGrelha,
    SecaoGrelha,
    Estabelecimento,
    Estudo,
    ExportacaoFinanceira,
    FiltroEstudo,
    Formacao,
    FotoVisita,
    Grelha,
    MensagemSistema,
    MensagemVisita,
    NotificacaoVisita,
    Onda,
    OrcamentoEstudo,
    PagamentoVisita,
    PermissaoEstudo,
    PlanoAcao,
    PortalCliente,
    Questionario,
    RespostaVisita,
    ResultadoFormacao,
    RetencaoDados,
    SubmissaoQuestionario,
    TabelaValores,
    TemplateCallCenter,
    TesteFormacao,
    ThresholdAcao,
    TipoVisitaConfig,
    Utilizador,
    Visita,
    ShelfAuditItem,
    Planogram,
    PlanogramComparacao,
)
from app.services import pii


SEED = 20260310
TODAY = date(2026, 3, 10)
NOW = datetime(2026, 3, 10, 12, 0, tzinfo=timezone.utc)
random.seed(SEED)


ANALYST_PROFILES = [
    {
        "nome": "Ana Silva",
        "email": "ana.silva@demo.pt",
        "codigo": "A001",
        "telefone": "912345001",
        "nif": "123456781",
        "iban": "PT50000201231234567890001",
        "morada": "Rua de Santa Catarina 118, Porto",
        "data_nascimento": "1991-04-11",
        "grupo": "mid",
        "bias": 0.58,
    },
    {
        "nome": "Bruno Costa",
        "email": "bruno.costa@demo.pt",
        "codigo": "A002",
        "telefone": "912345002",
        "nif": "123456782",
        "iban": "PT50000201231234567890002",
        "morada": "Rua de Cedofeita 77, Porto",
        "data_nascimento": "1988-01-23",
        "grupo": "mid",
        "bias": 0.54,
    },
    {
        "nome": "Carla Mendes",
        "email": "carla.mendes@demo.pt",
        "codigo": "A003",
        "telefone": "912345003",
        "nif": "123456783",
        "iban": "PT50000201231234567890003",
        "morada": "Rua do Campo Alegre 412, Porto",
        "data_nascimento": "1994-08-16",
        "grupo": "mid",
        "bias": 0.56,
    },
    {
        "nome": "David Pereira",
        "email": "david.pereira@demo.pt",
        "codigo": "A004",
        "telefone": "912345004",
        "nif": "123456784",
        "iban": "PT50000201231234567890004",
        "morada": "Avenida da Liberdade 201, Lisboa",
        "data_nascimento": "1987-02-07",
        "grupo": "top",
        "bias": 0.92,
    },
    {
        "nome": "Eva Rodrigues",
        "email": "eva.rodrigues@demo.pt",
        "codigo": "A005",
        "telefone": "912345005",
        "nif": "123456785",
        "iban": "PT50000201231234567890005",
        "morada": "Rua de Entrecampos 95, Lisboa",
        "data_nascimento": "1990-12-18",
        "grupo": "top",
        "bias": 0.89,
    },
    {
        "nome": "Filipe Santos",
        "email": "filipe.santos@demo.pt",
        "codigo": "A006",
        "telefone": "912345006",
        "nif": "123456786",
        "iban": "PT50000201231234567890006",
        "morada": "Rua do Amial 54, Porto",
        "data_nascimento": "1985-09-27",
        "grupo": "low",
        "bias": 0.22,
    },
    {
        "nome": "Gabriela Oliveira",
        "email": "gabriela.oliveira@demo.pt",
        "codigo": "A007",
        "telefone": "912345007",
        "nif": "123456787",
        "iban": "PT50000201231234567890007",
        "morada": "Rua de São Victor 12, Braga",
        "data_nascimento": "1993-05-02",
        "grupo": "low",
        "bias": 0.18,
    },
    {
        "nome": "Hugo Martins",
        "email": "hugo.martins@demo.pt",
        "codigo": "A008",
        "telefone": "912345008",
        "nif": "123456788",
        "iban": "PT50000201231234567890008",
        "morada": "Praça da República 45, Coimbra",
        "data_nascimento": "1992-07-20",
        "grupo": "top",
        "bias": 0.86,
    },
    {
        "nome": "Inês Ferreira",
        "email": "ines.ferreira@demo.pt",
        "codigo": "A009",
        "telefone": "912345009",
        "nif": "123456789",
        "iban": "PT50000201231234567890009",
        "morada": "Rua do Brasil 132, Coimbra",
        "data_nascimento": "1996-03-10",
        "grupo": "improving",
        "bias": 0.38,
    },
    {
        "nome": "João Almeida",
        "email": "joao.almeida@demo.pt",
        "codigo": "A010",
        "telefone": "912345010",
        "nif": "123456790",
        "iban": "PT50000201231234567890010",
        "morada": "Rua Miguel Bombarda 88, Faro",
        "data_nascimento": "1989-11-04",
        "grupo": "improving",
        "bias": 0.34,
    },
    {
        "nome": "Leonor Sousa",
        "email": "leonor.sousa@demo.pt",
        "codigo": "A011",
        "telefone": "912345011",
        "nif": "123456791",
        "iban": "PT50000201231234567890011",
        "morada": "Rua Serpa Pinto 7, Leiria",
        "data_nascimento": "1995-06-08",
        "grupo": "improving",
        "bias": 0.40,
    },
    {
        "nome": "Miguel Ribeiro",
        "email": "miguel.ribeiro@demo.pt",
        "codigo": "A012",
        "telefone": "912345012",
        "nif": "123456792",
        "iban": "PT50000201231234567890012",
        "morada": "Avenida 25 de Abril 33, Setúbal",
        "data_nascimento": "1986-10-29",
        "grupo": "declining",
        "bias": 0.78,
    },
    {
        "nome": "Nuno Cardoso",
        "email": "nuno.cardoso@demo.pt",
        "codigo": "A013",
        "telefone": "912345013",
        "nif": "123456793",
        "iban": "PT50000201231234567890013",
        "morada": "Rua João XXI 19, Lisboa",
        "data_nascimento": "1991-01-14",
        "grupo": "declining",
        "bias": 0.74,
    },
    {
        "nome": "Patrícia Lopes",
        "email": "patricia.lopes@demo.pt",
        "codigo": "A014",
        "telefone": "912345014",
        "nif": "123456794",
        "iban": "PT50000201231234567890014",
        "morada": "Rua de Santa Luzia 24, Viseu",
        "data_nascimento": "1994-04-25",
        "grupo": "declining",
        "bias": 0.70,
    },
    {
        "nome": "Ricardo Teixeira",
        "email": "ricardo.teixeira@demo.pt",
        "codigo": "A015",
        "telefone": "912345015",
        "nif": "123456795",
        "iban": "PT50000201231234567890015",
        "morada": "Rua Elias Garcia 60, Amadora",
        "data_nascimento": "1988-07-13",
        "grupo": "low",
        "bias": 0.28,
    },
]


STUDY_BLUEPRINTS = [
    {
        "slug": "vodafone",
        "client_name": "ConnectSuite Pro",
        "portal": {"subdominio": "connectsuite-demo", "nome_marca": "ConnectSuite Pro Insights", "cor_primaria": "#E60000", "cor_secundaria": "#4A0D12"},
        "study_name": "Mystery Shopping ConnectSuite Pro 2025-2026",
        "fields": [
            "Região", "Distrito", "Loja", "Código Loja", "Tipo Canal", "Produto Avaliado",
            "Tempo Atendimento (min)", "NPS", "Abordagem Inicial", "Tratamento Objeções", "Upsell", "Observações",
        ],
        "filters": [("Região", "Região"), ("Tipo Canal", "Canal"), ("Produto Avaliado", "Produto")],
        "criteria": [
            "Saudação inicial", "Tempo de espera", "Conhecimento técnico", "Adequação da proposta",
            "Transparência comercial", "Empatia", "Fecho da venda", "Imagem da loja",
        ],
        "waves": [
            {"label": "Wave Outono 2025", "start": date(2025, 9, 1), "end": date(2025, 10, 20)},
            {"label": "Wave Inverno 2025", "start": date(2025, 11, 10), "end": date(2026, 1, 10)},
            {"label": "Wave Primavera 2026", "start": date(2026, 2, 1), "end": date(2026, 3, 25)},
        ],
        "budget": 98000.0,
        "visit_values": {"normal": (30.0, 10.0), "extra": (42.0, 15.0)},
        "threshold": 72.0,
        "photo_rule": ("normal", "LVI", 2),
        "establishments": [
            ("CS Colombo", "LVI", "Lisboa", "Lisboa", "CS001", "Centro Colombo, Lisboa", 38.7520, -9.1796),
            ("CS Vasco da Gama", "LVI", "Lisboa", "Lisboa", "CS002", "Centro Vasco da Gama, Lisboa", 38.7677, -9.1000),
            ("CS Chiado", "LVI", "Lisboa", "Lisboa", "CS003", "Rua do Carmo 21, Lisboa", 38.7103, -9.1422),
            ("CS Cascaishopping", "LVI", "Lisboa", "Lisboa", "CS004", "CascaiShopping, Alcabideche", 38.7293, -9.4222),
            ("CS NorteShopping", "LVI", "Porto", "Porto", "CS005", "NorteShopping, Matosinhos", 41.1832, -8.6817),
            ("CS MarShopping", "LVI", "Porto", "Porto", "CS006", "MarShopping, Matosinhos", 41.2312, -8.6689),
            ("CS Gaiashopping", "LVI", "Porto", "Porto", "CS007", "GaiaShopping, Vila Nova de Gaia", 41.1190, -8.5890),
            ("CS Braga Parque", "LVI", "Norte", "Braga", "CS008", "Braga Parque, Braga", 41.5590, -8.3930),
            ("CS Forum Coimbra", "LVI", "Centro", "Coimbra", "CS009", "Forum Coimbra, Coimbra", 40.2145, -8.4140),
            ("CS Forum Algarve", "LVI", "Sul", "Faro", "CS010", "Forum Algarve, Faro", 37.0197, -7.9304),
        ],
        "questionnaire": {
            "nome": "Questionário Operacional ConnectSuite Pro",
            "estrutura": {
                "seccoes": [
                    {"titulo": "Atendimento", "perguntas": [
                        {"id": "fila", "tipo": "number", "label": "Minutos de espera"},
                        {"id": "cumprimento", "tipo": "boolean", "label": "Houve saudação adequada?"},
                        {"id": "produto", "tipo": "select", "label": "Produto discutido", "opcoes": ["Móvel", "Fibra", "TV", "Convergente", "Empresas"]},
                    ]},
                    {"titulo": "Fecho", "perguntas": [
                        {"id": "upsell", "tipo": "boolean", "label": "Foi feito upsell?"},
                        {"id": "comentario", "tipo": "text", "label": "Comentário livre"},
                    ]},
                ]
            },
        },
        "training": {"titulo": "Formação ConnectSuite Pro Retail", "perguntas": [
            ("Qual o SLA máximo para acolhimento ao cliente em loja?", ["2 min", "5 min", "10 min"], 1),
            ("Quando deve ser tentado um upsell?", ["Nunca", "Apenas após necessidade identificada", "Sempre na saudação"], 1),
        ]},
        "callcenter": "telco",
    },
    {
        "slug": "nos",
        "client_name": "MediaSuite Plus",
        "portal": {"subdominio": "mediasuite-demo", "nome_marca": "MediaSuite Plus Experience", "cor_primaria": "#FFCC00", "cor_secundaria": "#111111"},
        "study_name": "Auditoria de Experiência MediaSuite Plus 2025-2026",
        "fields": [
            "Região", "Cidade", "Loja", "Código Loja", "Tipo Canal", "Campanha", "Tempo Espera (min)",
            "Diagnóstico", "Demonstração Produto", "Clareza Comercial", "Encaminhamento", "Observações",
        ],
        "filters": [("Região", "Região"), ("Campanha", "Campanha"), ("Tipo Canal", "Canal")],
        "criteria": [
            "Acolhimento", "Tempo de espera", "Descoberta de necessidades", "Demonstração do serviço",
            "Argumentação comercial", "Fecho de venda", "Clareza documental", "Imagem do espaço",
        ],
        "waves": [
            {"label": "Onda Setembro 2025", "start": date(2025, 9, 15), "end": date(2025, 10, 30)},
            {"label": "Onda Janeiro 2026", "start": date(2026, 1, 5), "end": date(2026, 2, 5)},
            {"label": "Onda Março 2026", "start": date(2026, 2, 15), "end": date(2026, 3, 28)},
        ],
        "budget": 87000.0,
        "visit_values": {"normal": (28.0, 8.0), "extra": (38.0, 12.0)},
        "threshold": 70.0,
        "photo_rule": ("normal", "LVI", 2),
        "establishments": [
            ("MS Colombo", "LVI", "Lisboa", "Lisboa", "MS001", "Centro Colombo, Lisboa", 38.7523, -9.1801),
            ("MS Amoreiras", "LVI", "Lisboa", "Lisboa", "MS002", "Centro Comercial Amoreiras, Lisboa", 38.7221, -9.1592),
            ("MS Almada Fórum", "LVI", "Sul", "Setúbal", "MS003", "Almada Fórum, Almada", 38.6546, -9.1772),
            ("MS Gaia Shopping", "LVI", "Porto", "Porto", "MS004", "GaiaShopping, Vila Nova de Gaia", 41.1191, -8.5886),
            ("MS Arrábida", "LVI", "Porto", "Porto", "MS005", "Arrábida Shopping, Gaia", 41.1416, -8.6413),
            ("MS Braga Parque", "LVI", "Norte", "Braga", "MS006", "Braga Parque, Braga", 41.5590, -8.3928),
            ("MS Fórum Coimbra", "LVI", "Centro", "Coimbra", "MS007", "Forum Coimbra, Coimbra", 40.2148, -8.4136),
            ("MS Fórum Viseu", "LVI", "Centro", "Viseu", "MS008", "Palácio do Gelo, Viseu", 40.6441, -7.9135),
            ("MS Faro Rua Santo António", "LVI", "Sul", "Faro", "MS009", "Rua de Santo António 34, Faro", 37.0172, -7.9350),
            ("MS Leiria Shopping", "LVI", "Centro", "Leiria", "MS010", "LeiriaShopping, Leiria", 39.7434, -8.8087),
        ],
        "questionnaire": {
            "nome": "Questionário Comercial MediaSuite Plus",
            "estrutura": {
                "seccoes": [
                    {"titulo": "Diagnóstico", "perguntas": [
                        {"id": "necessidade", "tipo": "select", "label": "Necessidade principal", "opcoes": ["Móvel", "Internet", "TV", "Pacote", "Empresas"]},
                        {"id": "comparacao", "tipo": "boolean", "label": "Foi feita comparação com concorrência?"},
                    ]},
                    {"titulo": "Execução", "perguntas": [
                        {"id": "espera", "tipo": "number", "label": "Tempo de espera"},
                        {"id": "comentario", "tipo": "text", "label": "Resumo da interação"},
                    ]},
                ]
            },
        },
        "training": {"titulo": "Guia de Execução MediaSuite Plus", "perguntas": [
            ("A demonstração de produto é obrigatória quando aplicável?", ["Sim", "Não"], 0),
            ("Qual o limite alvo de espera em loja?", ["3 minutos", "7 minutos", "12 minutos"], 1),
        ]},
        "callcenter": "telco",
    },
    {
        "slug": "mcdonalds",
        "client_name": "FoodSuite QSR",
        "portal": {"subdominio": "foodsuite-demo", "nome_marca": "FoodSuite QSR Service", "cor_primaria": "#FFC300", "cor_secundaria": "#D52B1E"},
        "study_name": "Auditoria de Serviço FoodSuite QSR 2025-2026",
        "fields": [
            "Região", "Cidade", "Restaurante", "Código", "Formato", "Faixa Horária", "Fila (min)",
            "Limpeza Sala", "Tempo Entrega", "Sugestão Complementar", "Temperatura Produto", "Observações",
        ],
        "filters": [("Região", "Região"), ("Formato", "Formato"), ("Faixa Horária", "Faixa Horária")],
        "criteria": [
            "Tempo de fila", "Cortesia", "Exactidão do pedido", "Sugestão de menu", "Limpeza", "Tempo de entrega", "Qualidade do produto", "Gestão de reclamação",
        ],
        "waves": [
            {"label": "Wave Outubro 2025", "start": date(2025, 10, 1), "end": date(2025, 11, 10)},
            {"label": "Wave Dezembro 2025", "start": date(2025, 12, 1), "end": date(2026, 1, 15)},
            {"label": "Wave Fevereiro 2026", "start": date(2026, 2, 1), "end": date(2026, 3, 20)},
        ],
        "budget": 76000.0,
        "visit_values": {"normal": (24.0, 7.0), "extra": (32.0, 10.0)},
        "threshold": 75.0,
        "photo_rule": ("normal", "LVI", 3),
        "establishments": [
            ("FS Colombo", "LVI", "Lisboa", "Lisboa", "FS001", "Centro Colombo, Lisboa", 38.7524, -9.1800),
            ("FS Saldanha", "LVI", "Lisboa", "Lisboa", "FS002", "Praça Duque de Saldanha, Lisboa", 38.7341, -9.1454),
            ("FS Almada Fórum", "LVI", "Sul", "Setúbal", "FS003", "Almada Fórum, Almada", 38.6541, -9.1767),
            ("FS NorteShopping", "LVI", "Porto", "Porto", "FS004", "NorteShopping, Matosinhos", 41.1830, -8.6815),
            ("FS Boavista", "LVI", "Porto", "Porto", "FS005", "Praça da Boavista, Porto", 41.1609, -8.6291),
            ("FS Braga Centro", "LVI", "Norte", "Braga", "FS006", "Avenida Central, Braga", 41.5503, -8.4201),
            ("FS Fórum Coimbra", "LVI", "Centro", "Coimbra", "FS007", "Forum Coimbra, Coimbra", 40.2149, -8.4137),
            ("FS Aveiro Centro", "LVI", "Centro", "Aveiro", "FS008", "Rua de Coimbra 12, Aveiro", 40.6405, -8.6538),
            ("FS Faro Fórum", "LVI", "Sul", "Faro", "FS009", "Forum Algarve, Faro", 37.0198, -7.9302),
            ("FS Funchal La Vie", "LVI", "Ilhas", "Madeira", "FS010", "La Vie Funchal, Funchal", 32.6480, -16.9114),
        ],
        "questionnaire": {
            "nome": "Questionário Restaurante FoodSuite",
            "estrutura": {
                "seccoes": [
                    {"titulo": "Pedido", "perguntas": [
                        {"id": "fila", "tipo": "number", "label": "Minutos de fila"},
                        {"id": "upsell", "tipo": "boolean", "label": "Foi sugerido complemento?"},
                    ]},
                    {"titulo": "Qualidade", "perguntas": [
                        {"id": "limpeza", "tipo": "scale", "label": "Limpeza da sala", "min": 1, "max": 5},
                        {"id": "comentario", "tipo": "text", "label": "Notas"},
                    ]},
                ]
            },
        },
        "training": {"titulo": "Padrões FoodSuite QSR", "perguntas": [
            ("O upsell deve ser tentado em todos os pedidos?", ["Sim, quando adequado", "Nunca"], 0),
            ("A limpeza da sala faz parte da avaliação?", ["Sim", "Não"], 0),
        ]},
        "callcenter": "restauracao",
    },
    {
        "slug": "galp",
        "client_name": "EnergySuite Retail",
        "portal": {"subdominio": "energysuite-demo", "nome_marca": "EnergySuite Retail Service", "cor_primaria": "#FF6600", "cor_secundaria": "#003366"},
        "study_name": "Auditoria Operacional Postos EnergySuite 2025-2026",
        "fields": [
            "Região", "Cidade", "Posto", "Código", "Formato", "Combustível Avaliado", "Fila Caixa (min)",
            "Oferta Loja", "Venda Cruzada", "Limpeza WC", "Condição Pista", "Observações",
        ],
        "filters": [("Região", "Região"), ("Formato", "Formato"), ("Combustível Avaliado", "Combustível")],
        "criteria": [
            "Acolhimento", "Tempo de caixa", "Sugestão loja", "Disponibilidade de pista", "Limpeza WC", "Conformidade de imagem", "Segurança", "Gestão de incidentes",
        ],
        "waves": [
            {"label": "Onda Setembro 2025", "start": date(2025, 9, 10), "end": date(2025, 10, 25)},
            {"label": "Onda Dezembro 2025", "start": date(2025, 12, 5), "end": date(2026, 1, 20)},
            {"label": "Onda Março 2026", "start": date(2026, 2, 10), "end": date(2026, 3, 29)},
        ],
        "budget": 112000.0,
        "visit_values": {"normal": (34.0, 12.0), "extra": (46.0, 18.0)},
        "threshold": 73.0,
        "photo_rule": ("normal", "LVI", 4),
        "establishments": [
            ("ES Segunda Circular", "LVI", "Lisboa", "Lisboa", "ES001", "Segunda Circular, Lisboa", 38.7603, -9.1575),
            ("ES Sacavém", "LVI", "Lisboa", "Lisboa", "ES002", "IC2 Sacavém", 38.7950, -9.1064),
            ("ES Almada A2", "LVI", "Sul", "Setúbal", "ES003", "A2 Almada", 38.6201, -9.1691),
            ("ES Porto AEP", "LVI", "Porto", "Porto", "ES004", "Via Norte, Porto", 41.1927, -8.6521),
            ("ES Gaia Arrábida", "LVI", "Porto", "Porto", "ES005", "VL8 Gaia", 41.1387, -8.6447),
            ("ES Braga Norte", "LVI", "Norte", "Braga", "ES006", "EN14 Braga", 41.5607, -8.4274),
            ("ES Coimbra Solum", "LVI", "Centro", "Coimbra", "ES007", "Avenida Dias da Silva, Coimbra", 40.2043, -8.4049),
            ("ES Aveiro Forca", "LVI", "Centro", "Aveiro", "ES008", "Avenida Dr Lourenço Peixinho, Aveiro", 40.6409, -8.6517),
            ("ES Faro Aeroporto", "LVI", "Sul", "Faro", "ES009", "EN125 Faro Aeroporto", 37.0182, -7.9687),
            ("ES Évora Circular", "LVI", "Alentejo", "Évora", "ES010", "Circular de Évora", 38.5710, -7.9060),
            ("ES Leiria IC2", "LVI", "Centro", "Leiria", "ES011", "IC2 Leiria", 39.7565, -8.8055),
        ],
        "questionnaire": {
            "nome": "Questionário Operacional EnergySuite",
            "estrutura": {
                "seccoes": [
                    {"titulo": "Pista", "perguntas": [
                        {"id": "pista_limpa", "tipo": "boolean", "label": "Pista limpa?"},
                        {"id": "combustivel", "tipo": "select", "label": "Combustível", "opcoes": ["Gasolina", "Gasóleo", "GPL", "EV"]},
                    ]},
                    {"titulo": "Loja", "perguntas": [
                        {"id": "wc", "tipo": "scale", "label": "Limpeza WC", "min": 1, "max": 5},
                        {"id": "nota", "tipo": "text", "label": "Incidente observado"},
                    ]},
                ]
            },
        },
        "training": {"titulo": "Procedimentos EnergySuite Retail", "perguntas": [
            ("O WC faz parte do roteiro obrigatório?", ["Sim", "Não"], 0),
            ("Qual a prioridade em incidente de pista?", ["Segurança", "Venda cruzada", "Rapidez"], 0),
        ]},
        "callcenter": "combustivel",
    },
    {
        "slug": "fnac",
        "client_name": "TechRetailSuite",
        "portal": {"subdominio": "techretail-demo", "nome_marca": "TechRetailSuite Experience", "cor_primaria": "#FFD100", "cor_secundaria": "#1A1A1A"},
        "study_name": "Experiência de Venda TechRetailSuite 2025-2026",
        "fields": [
            "Região", "Cidade", "Loja", "Código", "Secção", "Produto Testado", "Tempo Atendimento (min)",
            "Demonstração", "Garantia Estendida", "Cross-sell", "Disponibilidade Stock", "Observações",
        ],
        "filters": [("Região", "Região"), ("Secção", "Secção"), ("Produto Testado", "Produto")],
        "criteria": [
            "Acolhimento", "Abordagem especializada", "Demonstração do produto", "Conhecimento técnico", "Venda adicional", "Clareza de preço", "Fecho", "Organização da secção",
        ],
        "waves": [
            {"label": "Wave Black Friday 2025", "start": date(2025, 11, 1), "end": date(2025, 12, 5)},
            {"label": "Wave Saldos 2026", "start": date(2026, 1, 8), "end": date(2026, 2, 12)},
            {"label": "Wave Primavera 2026", "start": date(2026, 2, 20), "end": date(2026, 3, 30)},
        ],
        "budget": 84000.0,
        "visit_values": {"normal": (29.0, 9.0), "extra": (39.0, 13.0)},
        "threshold": 74.0,
        "photo_rule": ("normal", "LVI", 2),
        "establishments": [
            ("TR Colombo", "LVI", "Lisboa", "Lisboa", "TR001", "Centro Colombo, Lisboa", 38.7522, -9.1795),
            ("TR Vasco da Gama", "LVI", "Lisboa", "Lisboa", "TR002", "Centro Vasco da Gama, Lisboa", 38.7675, -9.0997),
            ("TR Almada Fórum", "LVI", "Sul", "Setúbal", "TR003", "Almada Fórum, Almada", 38.6540, -9.1770),
            ("TR NorteShopping", "LVI", "Porto", "Porto", "TR004", "NorteShopping, Matosinhos", 41.1834, -8.6812),
            ("TR Santa Catarina", "LVI", "Porto", "Porto", "TR005", "Rua de Santa Catarina, Porto", 41.1476, -8.6060),
            ("TR Braga", "LVI", "Norte", "Braga", "TR006", "Braga Parque, Braga", 41.5591, -8.3927),
            ("TR Coimbra", "LVI", "Centro", "Coimbra", "TR007", "Dolce Vita Coimbra, Coimbra", 40.2182, -8.3895),
            ("TR Aveiro", "LVI", "Centro", "Aveiro", "TR008", "Forum Aveiro, Aveiro", 40.6401, -8.6532),
            ("TR Faro", "LVI", "Sul", "Faro", "TR009", "Forum Algarve, Faro", 37.0199, -7.9301),
            ("TR Leiria", "LVI", "Centro", "Leiria", "TR010", "LeiriaShopping, Leiria", 39.7441, -8.8079),
        ],
        "questionnaire": {
            "nome": "Questionário Especialista TechRetailSuite",
            "estrutura": {
                "seccoes": [
                    {"titulo": "Produto", "perguntas": [
                        {"id": "demo", "tipo": "boolean", "label": "Foi feita demonstração?"},
                        {"id": "stock", "tipo": "boolean", "label": "Havia stock?"},
                    ]},
                    {"titulo": "Venda", "perguntas": [
                        {"id": "garantia", "tipo": "boolean", "label": "Foi apresentada garantia estendida?"},
                        {"id": "nota", "tipo": "text", "label": "Resumo técnico"},
                    ]},
                ]
            },
        },
        "training": {"titulo": "Especialização TechRetailSuite", "perguntas": [
            ("A demonstração deve ser prática sempre que possível?", ["Sim", "Não"], 0),
            ("A garantia estendida pode ser omitida?", ["Sim", "Não"], 1),
        ]},
        "callcenter": "retalho",
    },
]


# ---------------------------------------------------------------------------
# Multi-grid config: defines which evaluation grids each study should have.
# Each entry maps tipo_visita → { nome, secoes: [{nome, peso, criterios:[...]}]}
# Studies not listed here get a single legacy flat grid ("normal").
# ---------------------------------------------------------------------------
MULTI_GRID_CONFIG: dict[str, list[dict]] = {
    "vodafone": [
        {
            "tipo_visita": "presencial",
            "nome": "Grelha Loja Presencial",
            "secoes": [
                {"nome": "Acolhimento e Espera", "peso": 25.0, "criterios": [
                    ("Saudação inicial e abertura", 12.0),
                    ("Tempo de espera para atendimento", 13.0),
                ]},
                {"nome": "Diagnóstico e Proposta", "peso": 30.0, "criterios": [
                    ("Identificação de necessidades", 10.0),
                    ("Adequação da proposta ao perfil", 10.0),
                    ("Conhecimento técnico do produto", 10.0),
                ]},
                {"nome": "Negociação e Transparência", "peso": 25.0, "criterios": [
                    ("Transparência nas condições contratuais", 13.0),
                    ("Tratamento de objeções", 12.0),
                ]},
                {"nome": "Fecho e Imagem", "peso": 20.0, "criterios": [
                    ("Fecho da venda / proposta", 10.0),
                    ("Imagem e organização da loja", 10.0),
                ]},
            ],
        },
        {
            "tipo_visita": "telefonica",
            "nome": "Grelha Contacto Telefónico",
            "secoes": [
                {"nome": "Atendimento", "peso": 35.0, "criterios": [
                    ("Velocidade de atendimento (rings)", 18.0),
                    ("Fórmula de apresentação correta", 17.0),
                ]},
                {"nome": "Resolução", "peso": 40.0, "criterios": [
                    ("Diagnóstico do problema/motivo", 13.0),
                    ("Resolução no primeiro contacto (FCR)", 14.0),
                    ("Tom profissional e empático", 13.0),
                ]},
                {"nome": "Encerramento", "peso": 25.0, "criterios": [
                    ("Confirmação de resolução", 12.0),
                    ("Despedida e follow-up", 13.0),
                ]},
            ],
        },
    ],
    "nos": [
        {
            "tipo_visita": "presencial",
            "nome": "Grelha Loja NOS Presencial",
            "secoes": [
                {"nome": "Recepção", "peso": 20.0, "criterios": [
                    ("Acolhimento activo do cliente", 10.0),
                    ("Tempo de espera até ao atendimento", 10.0),
                ]},
                {"nome": "Exploração de Necessidades", "peso": 30.0, "criterios": [
                    ("Perguntas abertas de diagnóstico", 10.0),
                    ("Descoberta do uso actual do cliente", 10.0),
                    ("Comparação com oferta concorrente", 10.0),
                ]},
                {"nome": "Apresentação da Solução", "peso": 30.0, "criterios": [
                    ("Demonstração prática do serviço", 10.0),
                    ("Argumentação comercial estruturada", 10.0),
                    ("Clareza documental e condições", 10.0),
                ]},
                {"nome": "Fecho", "peso": 20.0, "criterios": [
                    ("Tentativa de fecho de venda", 10.0),
                    ("Imagem do espaço e sinalética", 10.0),
                ]},
            ],
        },
        {
            "tipo_visita": "telefonica",
            "nome": "Grelha Contacto Telefónico NOS",
            "secoes": [
                {"nome": "Atendimento Inicial", "peso": 40.0, "criterios": [
                    ("Tempo de resposta à chamada", 20.0),
                    ("Fórmula de saudação e identificação", 20.0),
                ]},
                {"nome": "Resolução e Qualidade", "peso": 60.0, "criterios": [
                    ("Diagnóstico correcto do motivo", 20.0),
                    ("Resolução efectiva no 1.º contacto", 20.0),
                    ("Cortesia e tom durante a chamada", 20.0),
                ]},
            ],
        },
    ],
    "mcdonalds": [
        {
            "tipo_visita": "presencial",
            "nome": "Grelha Sala / Balcão",
            "secoes": [
                {"nome": "Atendimento e Fila", "peso": 30.0, "criterios": [
                    ("Tempo de espera na fila de pedido", 15.0),
                    ("Cortesia e sorriso no atendimento", 15.0),
                ]},
                {"nome": "Pedido e Exactidão", "peso": 25.0, "criterios": [
                    ("Exactidão do pedido entregue", 13.0),
                    ("Sugestão de complemento (upsell)", 12.0),
                ]},
                {"nome": "Produto e Qualidade", "peso": 25.0, "criterios": [
                    ("Temperatura e qualidade do produto", 13.0),
                    ("Tempo total de entrega do pedido", 12.0),
                ]},
                {"nome": "Ambiente e Limpeza", "peso": 20.0, "criterios": [
                    ("Limpeza da sala e mesas", 10.0),
                    ("Gestão de reclamação / incidente", 10.0),
                ]},
            ],
        },
        {
            "tipo_visita": "drive_through",
            "nome": "Grelha Drive-Through",
            "secoes": [
                {"nome": "Fila e Comunicação", "peso": 40.0, "criterios": [
                    ("Tempo de espera na fila Drive-Thru", 20.0),
                    ("Clareza da comunicação no intercomunicador", 20.0),
                ]},
                {"nome": "Pedido e Entrega", "peso": 40.0, "criterios": [
                    ("Exactidão do pedido na janela", 20.0),
                    ("Tempo da janela até entrega", 20.0),
                ]},
                {"nome": "Serviço e Imagem", "peso": 20.0, "criterios": [
                    ("Cortesia e eficiência na janela", 10.0),
                    ("Estado e limpeza da área exterior", 10.0),
                ]},
            ],
        },
    ],
    "galp": [
        {
            "tipo_visita": "presencial",
            "nome": "Grelha Loja / Posto Interior",
            "secoes": [
                {"nome": "Área de Pista", "peso": 35.0, "criterios": [
                    ("Limpeza e organização da pista", 12.0),
                    ("Disponibilidade e estado das bombas", 12.0),
                    ("Sinalização correcta de preços", 11.0),
                ]},
                {"nome": "Loja de Conveniência", "peso": 35.0, "criterios": [
                    ("Atendimento e cortesia na loja", 12.0),
                    ("Disponibilidade de produtos essenciais", 12.0),
                    ("Limpeza e organização da loja", 11.0),
                ]},
                {"nome": "Instalações Sanitárias", "peso": 15.0, "criterios": [
                    ("Limpeza e higiene das casas de banho", 15.0),
                ]},
                {"nome": "Segurança e Conformidade", "peso": 15.0, "criterios": [
                    ("Sinalização de segurança visível", 8.0),
                    ("EPI obrigatório em uso", 7.0),
                ]},
            ],
        },
        {
            "tipo_visita": "drive_through",
            "nome": "Grelha Drive-Through Galp Wash",
            "secoes": [
                {"nome": "Lavagem e Serviço Rápido", "peso": 50.0, "criterios": [
                    ("Funcionamento do sistema de lavagem", 25.0),
                    ("Tempo total de serviço na pista", 25.0),
                ]},
                {"nome": "Atendimento e Caixa", "peso": 50.0, "criterios": [
                    ("Cortesia no atendimento do ponto de pagamento", 25.0),
                    ("Emissão correcta de recibo/fatura", 25.0),
                ]},
            ],
        },
    ],
}

# Mapping: which tipo_visita values exist per study (for visit generation)
STUDY_VISIT_TYPES: dict[str, list[str]] = {
    "vodafone": ["presencial", "presencial", "presencial", "telefonica"],  # 75% presencial, 25% telefonica
    "nos": ["presencial", "presencial", "presencial", "telefonica"],
    "mcdonalds": ["presencial", "presencial", "presencial", "drive_through"],  # 75% presencial, 25% drive-thru
    "galp": ["presencial", "presencial", "drive_through"],  # 67% presencial, 33% drive-thru
    "fnac": ["presencial"],  # single grid
}


MATURE_STATES = [
    ("fechada", 0.32),
    ("validada", 0.17),
    ("inserida", 0.10),
    ("corrigida", 0.06),
    ("corrigir", 0.05),
    ("corrigir_email", 0.03),
    ("planeada", 0.06),
    ("nova", 0.03),
    ("anulada", 0.05),
    ("para_alteracao", 0.04),
    ("situacao_especial", 0.05),
    ("sem_alteracoes", 0.04),
]

CURRENT_STATES = [
    ("nova", 0.22),
    ("planeada", 0.24),
    ("inserida", 0.14),
    ("validada", 0.09),
    ("corrigir", 0.07),
    ("corrigida", 0.04),
    ("anulada", 0.05),
    ("para_alteracao", 0.05),
    ("situacao_especial", 0.05),
    ("sem_alteracoes", 0.05),
]


SYSTEM_SETTINGS = [
    ("docs.roles.visible", "true", "Controla visibilidade por role na documentação"),
    ("ai.validation.enabled", "true", "Activa validação IA de visitas e fotos"),
    ("callcenter.auto_process", "true", "Processa gravações de call center automaticamente"),
]


def weighted_choice(options):
    threshold = random.random()
    total = 0.0
    for value, weight in options:
        total += weight
        if threshold <= total:
            return value
    return options[-1][0]


def random_dt(start: date, end: date, start_hour: int = 8, end_hour: int = 19) -> datetime:
    delta_days = max((end - start).days, 0)
    selected = start + timedelta(days=random.randint(0, delta_days))
    selected_time = time(hour=random.randint(start_hour, end_hour), minute=random.randint(0, 59))
    return datetime.combine(selected, selected_time, tzinfo=timezone.utc)


def analyst_bias(profile: dict, wave_index: int, total_waves: int) -> float:
    base = profile["bias"]
    if profile["grupo"] == "improving":
        if total_waves <= 1:
            return base
        return min(0.88, base + 0.16 * (wave_index / (total_waves - 1)))
    if profile["grupo"] == "declining":
        if total_waves <= 1:
            return base
        return max(0.22, base - 0.18 * (wave_index / (total_waves - 1)))
    return base


def generate_score(profile: dict, wave_index: int, total_waves: int, state: str) -> tuple[float | None, str]:
    if state in {"nova", "planeada"}:
        return None, "nao_avaliada"
    if state == "anulada":
        return None, random.choice(["nao_avaliada", "nao_aplicavel"])
    roll = random.random()
    if roll < 0.07:
        return None, "nao_avaliada"
    if roll < 0.10:
        return None, "nao_aplicavel"
    bias = analyst_bias(profile, wave_index, total_waves)
    mean = 42 + bias * 56
    deviation = 6 if profile["grupo"] in {"top", "low"} else 9
    score = max(8, min(100, round(random.gauss(mean, deviation), 2)))
    return score, "calculada"


def visit_coordinates(estab: Estabelecimento) -> tuple[float | None, float | None]:
    if estab.latitude is None or estab.longitude is None:
        return None, None
    return round(float(estab.latitude) + random.uniform(-0.0015, 0.0015), 7), round(float(estab.longitude) + random.uniform(-0.0015, 0.0015), 7)


def pick_comment(score: float | None, state: str, client: str) -> str:
    if state == "anulada":
        return random.choice([
            "Ponto de venda encerrado temporariamente durante a visita.",
            "Gerente informou indisponibilidade para atendimento no momento.",
        ])
    if score is None:
        return random.choice([
            "Visita sem avaliação final devido ao estado actual.",
            "Registo preparado mas ainda sem submissão fechada.",
        ])
    if score >= 90:
        return f"Execução muito forte no cliente {client}, com elevada consistência operacional."
    if score >= 75:
        return f"Boa experiência global no cliente {client}, com pequenas oportunidades de melhoria."
    if score >= 60:
        return f"Experiência irregular no cliente {client}; equipa cumpre o essencial mas falha consistência."
    return f"Execução fraca no cliente {client}, com falhas visíveis no processo e necessidade de acção correctiva."


def questionnaire_answers(study_slug: str, score: float | None) -> dict:
    positive = score is not None and score >= 75
    good = score is not None and score >= 60

    # Rich text comment pools per study type for word-cloud / sentiment AI
    COMMENTS_BY_SLUG: dict[str, list[str]] = {
        "vodafone": [
            "O colaborador demonstrou excelente conhecimento técnico do produto fibra e fibra + TV. Saudação proactiva logo à entrada.",
            "Tempo de espera elevado mas atendimento muito personalizado. Upsell bem argumentado e aceite pelo cliente.",
            "Abordagem comercial fraca; o colaborador não identificou as necessidades antes de apresentar a solução.",
            "Demonstração do smartphone foi interactiva e convincente. Cliente saiu com contrato assinado.",
            "Loja com boa imagem mas sem sinalética actualizada para a campanha actual. Atendimento demorou mais de 15 minutos.",
            "Excelente atenção ao detalhe na explicação das condições contratuais. Zero ambiguidade.",
            "Colaborador não tentou upsell após confirmar o pacote. Oportunidade perdida de convergente completo.",
            "Fecho de venda conseguido em menos de 20 minutos com proposta personalizada e demonstração prática.",
            "Atendimento telefónico com tempo de espera de 4 minutos. Diagnóstico correcto, solução implementada na chamada.",
            "O agente identificou correctamente o problema de facturação e resolveu sem transferências adicionais.",
        ],
        "nos": [
            "Diagnóstico de necessidades exemplar; o colaborador dedicou 5 minutos a entender o perfil do cliente antes de avançar.",
            "Argumentação comparativa com concorrência bem estruturada. Cliente ficou convencido com dados concretos.",
            "Pouca proactividade na abordagem inicial. O cliente teve de se dirigir ao balcão sem qualquer boas-vindas.",
            "Demonstração prática do serviço de TV falhou durante a visita por problema técnico da loja. Situação mal gerida.",
            "Equipa demonstrou excelente conhecimento das campanhas actuais e adaptou a proposta ao orçamento do cliente.",
            "Encaminhamento para departamento técnico foi bem feito, com acompanhamento até ao final.",
            "Clareza na explicação da documentação contratual. Cliente saiu totalmente esclarecido.",
            "Tempo de espera de 12 minutos sem qualquer reconhecimento da espera pelo colaborador.",
            "Muito boa gestão de objecção de preço com comparativo de custo-benefício eficaz.",
            "Atendimento telefónico com saudação correcta mas fórmula incompleta; não mencionou nome do departamento.",
        ],
        "mcdonalds": [
            "Fila rápida, pedido correcto e produto à temperatura ideal. Colaboradora sorriu e sugeriu sobremesa.",
            "Tempo de espera de 8 minutos na fila. Pedido incorrecto entregue; colaborador resolveu sem hesitação.",
            "Sala limpa e organizada. Mesa disponível imediatamente. Produto de boa qualidade e temperatura.",
            "Upsell de bebida premium bem integrado na entrega do pedido. Cliente aceitou.",
            "Limpeza dos WC insuficiente durante a visita. Sala com restos de tabuleiros por limpar.",
            "Drive-thru ágil: pedido em 90 segundos, entrega em 3 minutos. Zero erros no pedido.",
            "Colaborador no drive-thru comunicou de forma clara e eficiente. Receio de sujidade no exterior visível.",
            "Temperatura do produto abaixo do esperado. Batatas frias e hambúrguer morno.",
            "Reclamação gerida com rapidez e voucher de compensação imediato. Cliente saiu satisfeito.",
            "Sugestão de menu do dia bem integrada no atendimento. Tom amigável e profissional.",
        ],
        "galp": [
            "Pista limpa, bombas em funcionamento, sinalização de preços actualizada e visível.",
            "Colaboradora da loja muito atenciosa e sugeriu complemento de lavagem do veículo.",
            "WC em mau estado durante a visita. Limpeza claramente insuficiente.",
            "Sinalética de segurança correcta e pessoal com EPI completo. Conformidade total.",
            "Loja de conveniência com bom sortido e produto fresco disponível. Atendimento imediato.",
            "Tempo na caixa de 6 minutos. Sistema lento causou espera excessiva mas colaborador manteve tom profissional.",
            "Drive de lavagem em manutenção sem aviso prévio. Situação comunicada de forma adequada.",
            "Falta de gasolina simples disponível nas bombas durante 15 minutos. Situação gerida sem informação ao cliente.",
            "Emissão de factura correcta e sem demora. Colaborador conhecia bem o processo EV.",
            "Posto com excelente manutenção de imagem e conformidade de branding em todos os pontos de contacto.",
        ],
        "fnac": [
            "Especialista demonstrou profundo conhecimento do portátil solicitado e apresentou 3 alternativas adequadas.",
            "Secção de tecnologia bem organizada. Colaborador disponível imediatamente e proactivo na abordagem.",
            "Garantia estendida proposta de forma natural e bem argumentada. Cliente aceitou.",
            "Stock do produto pretendido inexistente. Gestão da situação fraca; sem oferta de encomenda.",
            "Cross-sell de acessório bem executado com demonstração prática de compatibilidade.",
            "Leitura de código EAN precisa e rápida no sistema. Preço confirmado instantaneamente.",
            "Fila na caixa de 10 minutos durante hora de ponta. Colaborador reconheceu a espera e agradeceu.",
            "Demonstração interactiva de headphones com estação de teste. Cliente muito satisfeito com experiência.",
            "Colaborador não sabia a data de disponibilidade de produto em pré-venda. Informação básica em falta.",
            "Secção gaming muito bem sinalizada e stock farto. Atendimento especializado e técnico de alto nível.",
        ],
    }

    comments_pool = COMMENTS_BY_SLUG.get(study_slug, [
        "Visita concluída com registo completo.",
        "Execução geral adequada com oportunidades de melhoria identificadas.",
    ])
    # Choose comment based on score for consistent sentiment polarity
    if score is not None and score >= 80:
        comment = random.choice([c for c in comments_pool if any(w in c.lower() for w in ["excelente", "ótimo", "muito", "boa", "bem", "rápido", "correcto", "sucesso", "satisfeito", "profundo", "proactivo", "ideal"])] or comments_pool[:4])
    elif score is not None and score < 55:
        comment = random.choice([c for c in comments_pool if any(w in c.lower() for w in ["fraco", "lento", "insuficiente", "mau", "errado", "falta", "pouco", "demorou", "não", "sem", "espera"])] or comments_pool[4:])
    else:
        comment = random.choice(comments_pool)

    return {
        "study": study_slug,
        "espera": random.randint(1, 12),
        "upsell": positive and random.random() > 0.25,
        "demo": positive or random.random() > 0.4,
        "stock": random.random() > 0.15,
        "wc": random.randint(2, 5) if positive else random.randint(1, 3),
        "comentario": comment,
        "nps": random.randint(8, 10) if positive else (random.randint(5, 7) if good else random.randint(1, 4)),
        "pontos_positivos": ", ".join(random.sample(["Simpatia", "Rapidez", "Conhecimento", "Clareza", "Proactividade", "Imagem da loja"], k=random.randint(1, 3))) if good else "",
        "pontos_negativos": ", ".join(random.sample(["Espera", "Stock", "Formação", "Sinalização", "Limpeza", "Lentidão"], k=random.randint(1, 2))) if not positive else "",
    }


def build_field_values(blueprint: dict, estab: Estabelecimento, wave_label: str, state: str, score: float | None) -> dict[str, str]:
    values = {
        "Região": estab.regiao or "",
        "Distrito": (estab.morada or "").split(",")[-1].strip() if estab.morada else "",
        "Cidade": (estab.morada or "").split(",")[-1].strip() if estab.morada else "",
        "Loja": estab.nome,
        "Restaurante": estab.nome,
        "Posto": estab.nome,
        "Código Loja": estab.id_loja_externo or "",
        "Código": estab.id_loja_externo or "",
        "Tipo Canal": estab.tipo_canal or "LVI",
        "Formato": random.choice(["Flagship", "Shopping", "Rua", "Drive", "Loja+Pista"]),
        "Produto Avaliado": random.choice(["Móvel", "Fibra", "TV", "Convergente", "Empresas"]),
        "Campanha": random.choice(["Fidelização", "Aquisição", "Upsell", "Renovação"]),
        "Faixa Horária": random.choice(["Almoço", "Jantar", "Pico tarde", "Fora de pico"]),
        "Combustível Avaliado": random.choice(["Gasolina", "Gasóleo", "GPL", "Carregamento EV"]),
        "Secção": random.choice(["Tecnologia", "Gaming", "Áudio", "Livraria"]),
        "Produto Testado": random.choice(["Smartphone", "Portátil", "Headphones", "TV"]),
        "Tempo Atendimento (min)": str(random.randint(2, 18)),
        "Tempo Espera (min)": str(random.randint(1, 15)),
        "Fila (min)": str(random.randint(0, 12)),
        "Fila Caixa (min)": str(random.randint(0, 10)),
        "NPS": str(random.randint(0, 10)),
        "Abordagem Inicial": random.choice(["Proactiva", "Reativa", "Tardia"]),
        "Tratamento Objeções": random.choice(["Consistente", "Parcial", "Fraco"]),
        "Upsell": random.choice(["Sim", "Não", "Parcial"]),
        "Observações": pick_comment(score, state, blueprint["client_name"]),
        "Diagnóstico": random.choice(["Completo", "Parcial", "Insuficiente"]),
        "Demonstração Produto": random.choice(["Sim", "Parcial", "Não"]),
        "Clareza Comercial": random.choice(["Clara", "Alguma ambiguidade", "Confusa"]),
        "Encaminhamento": random.choice(["Não necessário", "Feito", "Incompleto"]),
        "Limpeza Sala": random.choice(["Excelente", "Boa", "Irregular", "Fraca"]),
        "Tempo Entrega": str(random.randint(2, 11)),
        "Sugestão Complementar": random.choice(["Sim", "Não"]),
        "Temperatura Produto": random.choice(["Adequada", "Morna", "Fria"]),
        "Oferta Loja": random.choice(["Completa", "Parcial", "Reduzida"]),
        "Venda Cruzada": random.choice(["Sim", "Não", "Tentativa parcial"]),
        "Limpeza WC": random.choice(["Excelente", "Boa", "Insuficiente"]),
        "Condição Pista": random.choice(["Conforme", "Com necessidade de intervenção"]),
        "Demonstração": random.choice(["Sim", "Não", "Parcial"]),
        "Garantia Estendida": random.choice(["Sim", "Não"]),
        "Cross-sell": random.choice(["Sim", "Não"]),
        "Disponibilidade Stock": random.choice(["Disponível", "Stock limitado", "Sem stock"]),
        "Onda": wave_label,
    }
    return {field: str(values.get(field, random.choice(["Sim", "Não", "N/A", "Observado"]))) for field in blueprint["fields"]}


def should_have_photos(blueprint: dict, state: str) -> bool:
    if state in {"nova", "planeada", "anulada"}:
        return False
    return blueprint["slug"] in {"mcdonalds", "galp", "fnac"} or random.random() > 0.45


async def ensure_system_settings(db):
    for key, value, desc in SYSTEM_SETTINGS:
        existing = await db.get(ConfiguracaoSistema, key)
        if existing is None:
            db.add(ConfiguracaoSistema(chave=key, valor=value, descricao=desc))


async def ensure_callcenter_config(db):
    count = (await db.execute(sa_text("SELECT COUNT(*) FROM configuracoes_callcenter"))).scalar()
    if not count:
        db.add(ConfiguracaoCallCenter(roles_upload=["admin", "coordenador", "validador"], max_ficheiro_mb=100))


def build_call_templates(client_by_slug: dict[str, Cliente]) -> dict[str, TemplateCallCenter]:
    return {
        "telco": TemplateCallCenter(
            nome="Call Center ConnectSuite Pro",
            descricao="Template para linhas de apoio comercial e reclamações no sector telecom.",
            cliente_id=client_by_slug["vodafone"].id,
            campos=[
                {"chave": "espera", "label": "Tempo de espera", "tipo": "number", "peso": 10},
                {"chave": "empatia", "label": "Empatia", "tipo": "boolean", "peso": 20},
                {"chave": "diagnostico", "label": "Diagnóstico correcto", "tipo": "boolean", "peso": 20},
                {"chave": "solucao", "label": "Solução apresentada", "tipo": "boolean", "peso": 25},
                {"chave": "followup", "label": "Follow-up", "tipo": "boolean", "peso": 10},
                {"chave": "score_global", "label": "Score global", "tipo": "number", "peso": 15},
            ],
        ),
        "restauracao": TemplateCallCenter(
            nome="Customer Care FoodSuite QSR",
            descricao="Template para encomendas, reclamações e pós-venda em restauração.",
            cliente_id=client_by_slug["mcdonalds"].id,
            campos=[
                {"chave": "saudacao", "label": "Saudação", "tipo": "boolean", "peso": 15},
                {"chave": "pedido", "label": "Compreensão do pedido", "tipo": "boolean", "peso": 20},
                {"chave": "resolucao", "label": "Resolução", "tipo": "boolean", "peso": 30},
                {"chave": "cordialidade", "label": "Cordialidade", "tipo": "scale_5", "peso": 20},
                {"chave": "score_global", "label": "Score global", "tipo": "number", "peso": 15},
            ],
        ),
        "combustivel": TemplateCallCenter(
            nome="Linha de Apoio EnergySuite Retail",
            descricao="Template para apoio ao cliente em combustíveis, frota e mobilidade eléctrica.",
            cliente_id=client_by_slug["galp"].id,
            campos=[
                {"chave": "seguranca", "label": "Orientação de segurança", "tipo": "boolean", "peso": 20},
                {"chave": "tempo", "label": "Tempo de resposta", "tipo": "number", "peso": 10},
                {"chave": "clareza", "label": "Clareza", "tipo": "boolean", "peso": 20},
                {"chave": "resolucao", "label": "Resolução ou encaminhamento", "tipo": "boolean", "peso": 30},
                {"chave": "score_global", "label": "Score global", "tipo": "number", "peso": 20},
            ],
        ),
        "retalho": TemplateCallCenter(
            nome="Suporte Técnico TechRetailSuite",
            descricao="Template para apoio pós-venda, stock e encomendas em retalho especializado.",
            cliente_id=client_by_slug["fnac"].id,
            campos=[
                {"chave": "identificacao", "label": "Identificação do agente", "tipo": "boolean", "peso": 15},
                {"chave": "diagnostico", "label": "Diagnóstico técnico", "tipo": "boolean", "peso": 25},
                {"chave": "alternativa", "label": "Alternativa proposta", "tipo": "boolean", "peso": 20},
                {"chave": "followup", "label": "Follow-up", "tipo": "boolean", "peso": 20},
                {"chave": "score_global", "label": "Score global", "tipo": "number", "peso": 20},
            ],
        ),
    }


async def seed_callcenter_only(db, client_by_slug: dict[str, Cliente], study_by_slug: dict[str, Estudo], admin: Utilizador):
    existing_templates = (await db.execute(select(TemplateCallCenter))).scalars().all()
    template_by_kind: dict[str, TemplateCallCenter] = {}
    if existing_templates:
        for template in existing_templates:
            if "Telecom" in template.nome:
                template_by_kind["telco"] = template
            elif "Restauração" in template.nome:
                template_by_kind["restauracao"] = template
            elif "EnergySuite" in template.nome:
                template_by_kind["combustivel"] = template
            elif "TechRetail" in template.nome:
                template_by_kind["retalho"] = template
    else:
        template_by_kind = build_call_templates(client_by_slug)
        db.add_all(template_by_kind.values())
        await db.flush()

    existing_calls = (await db.execute(select(ChamadaCallCenter.id))).scalars().all()
    if existing_calls:
        return len(template_by_kind), len(existing_calls)

    call_specs = [
        # ConnectSuite Pro (telco)
        ("vodafone", "telco", "CC-CS-2026-001", "concluido", "Marta Correia", 81, "Cliente reporta falha de serviço e recebe explicação clara com escalada prioritária."),
        ("vodafone", "telco", "CC-CS-2026-002", "concluido", "Pedro Simões", 62, "Atendimento correcto mas com follow-up pouco assertivo. Agente não concluiu o diagnóstico."),
        ("vodafone", "telco", "CC-CS-2026-003", "concluido", "Ana Marques", 91, "Recontrátuação exemplar com upsell sustentado e fidelização conseguida."),
        ("vodafone", "telco", "CC-CS-2026-004", "concluido", "Luís Fonseca", 55, "Resolução incompleta; cliente voltou a contactar no mesmo dia."),
        ("vodafone", "telco", "CC-CS-2026-005", "erro", "Carlos Monteiro", None, "Ficheiro de áudio corrompido."),
        ("vodafone", "telco", "CC-CS-2026-006", "a_analisar", "Sofia Neves", None, "Em análise pelo pipeline de IA."),
        # MediaSuite Plus (telco)
        ("nos", "telco", "CC-MS-2026-001", "concluido", "Helena Duarte", 77, "Renovação contratual bem tratada com retenção bem argumentada."),
        ("nos", "telco", "CC-MS-2026-002", "concluido", "Tomás Varela", 44, "Tempo de espera excessivo e diagnóstico incompleto. Score muito baixo."),
        ("nos", "telco", "CC-MS-2026-003", "concluido", "Rita Costa", 83, "Excelente clareza na explicação da oferta convergente. Empatia elevada."),
        ("nos", "telco", "CC-MS-2026-004", "transcrevendo", "Bruno Gomes", None, "Transcrição em curso."),
        # FoodSuite QSR (restauração)
        ("mcdonalds", "restauracao", "CC-FS-2026-001", "concluido", "Sara Matos", 72, "Reclamação de pedido incompleto resolvida com voucher de compensação."),
        ("mcdonalds", "restauracao", "CC-FS-2026-002", "concluido", "Rui Barros", 65, "Problema de entrega resolvido mas sem proactividade do agente na compensação."),
        ("mcdonalds", "restauracao", "CC-FS-2026-003", "concluido", "Filipa Gonçalves", 88, "Gestão de situação crítica com alta cordialidade e resolução no 1º contacto."),
        ("mcdonalds", "restauracao", "CC-FS-2026-004", "pendente", "Carlos Lopes", None, "Fila de processamento."),
        # EnergySuite Retail (combustível)
        ("galp", "combustivel", "CC-ES-2026-001", "concluido", "Inês Faria", 85, "Pedido de factura e esclarecimento sobre frota resolvidos com segurança e empatia."),
        ("galp", "combustivel", "CC-ES-2026-002", "concluido", "Marco Dias", 70, "Orientação sobre carregamento EV correcta mas tom pouco profissional."),
        ("galp", "combustivel", "CC-ES-2026-003", "concluido", "Raquel Sousa", 92, "Excelente atendimento de frota empresarial com conhecimento técnico sólido."),
        ("galp", "combustivel", "CC-ES-2026-004", "a_analisar", "Nuno Vicente", None, "Em análise automática."),
        # TechRetailSuite (retalho)
        ("fnac", "retalho", "CC-TR-2026-001", "concluido", "Joana Franco", 79, "Suporte técnico com proposta de alternativa de stock aprovada pelo cliente."),
        ("fnac", "retalho", "CC-TR-2026-002", "concluido", "Ricardo Tavares", 58, "Resolução lenta e insatisfação moderada; follow-up não efectuado."),
        ("fnac", "retalho", "CC-TR-2026-003", "concluido", "Diana Leite", 86, "Cross-sell bem executado após diagnóstico completo. Cliente fidelizado."),
        ("fnac", "retalho", "CC-TR-2026-004", "pendente", "Mário Roxo", None, "A aguardar análise."),
        ("fnac", "retalho", "CC-TR-2026-005", "transcrevendo", "Cláudia Azevedo", None, "Transcrição Whisper em curso."),
    ]
    created = 0
    for idx, (slug, kind, ref, state, agent_name, score, summary) in enumerate(call_specs, start=1):
        score_payload = None
        report = None
        transcript = None
        if score is not None:
            quality = "excelente" if score >= 85 else ("bom" if score >= 70 else ("razoável" if score >= 55 else "fraco"))
            transcript = (
                f"Agente: Bom dia, fala {agent_name}, como posso ajudar?\n"
                f"Cliente: Bom dia. Tenho um problema com o meu serviço e preciso de apoio urgente.\n"
                f"Agente: Claro, vou verificar a situação imediatamente. Pode dar-me o número de contacto ou NIF?\n"
                f"Cliente: Sim, é o contacto {ref}. O problema é que o serviço não está a funcionar correctamente.\n"
                f"Agente: Percebi. Vou fazer um diagnóstico agora. {'Identifico o problema e consigo resolver já.' if score >= 70 else 'Pode demorar algum tempo a analisar.'}\n"
                f"Cliente: {'Óptimo, obrigado pela rapidez.' if score >= 70 else 'Estou à espera há muito tempo já.'}\n"
                f"Agente: {'A situação fica resolvida agora. Há mais alguma coisa em que possa ajudar?' if score >= 70 else 'Vou encaminhar para a equipa técnica e entrarão em contacto.'}\n"
                f"Cliente: {'Não, obrigado. Fui muito bem atendido.' if score >= 75 else 'Espero que sim. Não fico muito satisfeito com o atendimento.'}\n"
                f"Agente: Obrigado pelo contacto e tenha um bom dia."
            )
            score_payload = {
                "score_global": score,
                "empatia": score >= 70,
                "diagnostico": score >= 65,
                "solucao": score >= 60,
                "followup": score >= 75,
                "cordialidade": min(5, max(1, round(score / 20))),
            }
            report = (
                f"## Relatório de Avaliação — {ref}\n\n"
                f"**Agente:** {agent_name}\n"
                f"**Qualidade geral:** {quality.capitalize()}\n\n"
                f"**Resumo:** {summary}\n\n"
                f"### Pontuações por dimensão\n"
                f"- Saudação e identificação: {'✓' if score >= 65 else '✗'}\n"
                f"- Diagnóstico correcto: {'✓' if score >= 65 else '✗'}\n"
                f"- Solução apresentada: {'✓' if score >= 60 else '✗'}\n"
                f"- Empatia e cordialidade: {'✓' if score >= 70 else '✗'}\n"
                f"- Follow-up e fecho: {'✓' if score >= 75 else '✗'}\n\n"
                f"**Score global: {score}/100**\n\n"
                f"### Recomendações\n"
                + ("Manter o padrão e partilhar como boas práticas com a equipa." if score >= 80
                   else "Reforçar formação em diagnóstico e fecho de chamada." if score >= 60
                   else "Acompanhamento individualizado urgente. Score abaixo do mínimo aceitável.")
            )
        db.add(
            ChamadaCallCenter(
                cliente_id=client_by_slug[slug].id,
                estudo_id=study_by_slug[slug].id,
                template_id=template_by_kind[kind].id,
                nome_ficheiro=f"{ref.lower()}.mp3",
                url_minio=f"demo/callcenter/{ref.lower()}.mp3",
                tamanho=2_500_000 + idx * 191_201,
                mime_type="audio/mpeg",
                duracao_segundos=180 + idx * 17 if score is not None else None,
                estado=state,
                erro_mensagem="Erro Whisper: ficheiro corrompido" if state == "erro" else None,
                transcricao=transcript,
                dados_extraidos=score_payload,
                relatorio=report,
                score_global=score,
                referencia_externa=ref,
                agente_nome=agent_name,
                data_chamada=NOW - timedelta(days=idx * 4),
                submetido_por_id=admin.id,
            )
        )
        created += 1
    return len(template_by_kind), created


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        existing_admin = await db.execute(select(Utilizador).where(Utilizador.username == "admin"))
        if existing_admin.scalar_one_or_none():
            print("⚠ Demo data already exists. Skipping comprehensive seed.")
            return

        await ensure_system_settings(db)
        await ensure_callcenter_config(db)

        admin = Utilizador(username="admin", email=pii.encrypt("admin@estudosmercado.pt"), password_hash=hash_password("Cognira@Admin2026"), role_global="admin", activo=True)
        coordenador = Utilizador(username="coordenador", email=pii.encrypt("coord@estudosmercado.pt"), password_hash=hash_password("Cognira@Coord2026"), role_global="coordenador", activo=True)
        validador = Utilizador(username="validador", email=pii.encrypt("validador@estudosmercado.pt"), password_hash=hash_password("Cognira@Valid2026"), role_global="validador", activo=True)
        analista_user = Utilizador(username="analista1", email=pii.encrypt("ana.silva@demo.pt"), password_hash=hash_password("Cognira@Anal2026"), role_global="analista", activo=True)
        client_users = [
            Utilizador(username="cliente_vodafone", email=pii.encrypt("cliente.vf@demo.pt"), password_hash=hash_password("Cognira@Vodafone26"), role_global="utilizador", activo=True),
            Utilizador(username="cliente_nos", email=pii.encrypt("cliente.nos@demo.pt"), password_hash=hash_password("Cognira@Nos2026"), role_global="utilizador", activo=True),
            Utilizador(username="cliente_mcd", email=pii.encrypt("cliente.mcd@demo.pt"), password_hash=hash_password("Cognira@Mcd2026"), role_global="utilizador", activo=True),
            Utilizador(username="cliente_galp", email=pii.encrypt("cliente.galp@demo.pt"), password_hash=hash_password("Cognira@Galp2026"), role_global="utilizador", activo=True),
            Utilizador(username="cliente_fnac", email=pii.encrypt("cliente.fnac@demo.pt"), password_hash=hash_password("Cognira@Fnac2026"), role_global="utilizador", activo=True),
        ]
        all_users = [admin, coordenador, validador, analista_user, *client_users]
        db.add_all(all_users)
        await db.flush()

        for user in all_users:
            db.add(ConsentimentoRgpd(utilizador_id=user.id, tipo="privacy_policy", aceite=True, data=NOW - timedelta(days=random.randint(20, 320)), versao_politica="2026.1"))

        clients = []
        client_by_slug: dict[str, Cliente] = {}
        for blueprint in STUDY_BLUEPRINTS:
            client = Cliente(nome=blueprint["client_name"])
            db.add(client)
            clients.append(client)
            client_by_slug[blueprint["slug"]] = client
        await db.flush()

        for blueprint in STUDY_BLUEPRINTS:
            portal = blueprint["portal"]
            db.add(
                PortalCliente(
                    cliente_id=client_by_slug[blueprint["slug"]].id,
                    subdominio=portal["subdominio"],
                    logo_url_minio=f"branding/{blueprint['slug']}/logo.svg",
                    cor_primaria=portal["cor_primaria"],
                    cor_secundaria=portal["cor_secundaria"],
                    nome_marca=portal["nome_marca"],
                    activo=True,
                )
            )

        analysts: list[Analista] = []
        analyst_profile_by_id: dict[int, dict] = {}
        for idx, profile in enumerate(ANALYST_PROFILES, start=1):
            analyst = Analista(
                nome=profile["nome"].encode("utf-8"),
                codigo_externo=profile["codigo"],
                email=pii.encrypt(profile["email"]),
                telefone=pii.encrypt(profile["telefone"]),
                nif=pii.encrypt(profile["nif"]),
                iban=pii.encrypt(profile["iban"]),
                morada=pii.encrypt(profile["morada"]),
                data_nascimento=pii.encrypt(profile["data_nascimento"]),
                activo=True,
                data_recrutamento=TODAY - timedelta(days=380 + idx * 17),
            )
            db.add(analyst)
            analysts.append(analyst)
        await db.flush()
        for analyst, profile in zip(analysts, ANALYST_PROFILES, strict=True):
            analyst_profile_by_id[analyst.id] = profile

        for idx in range(6):
            application = CandidaturaRecrutamento(
                nome=pii.encrypt(f"Candidato {idx + 1}"),
                email=pii.encrypt(f"candidato{idx + 1}@demo.pt"),
                telefone=pii.encrypt(f"9134500{idx + 1}"),
                morada=pii.encrypt(random.choice(["Porto", "Lisboa", "Coimbra", "Faro"])) ,
                disponibilidade=random.choice(["Semana inteira", "Pós-laboral", "Fins-de-semana"]),
                veiculo=random.choice([True, False]),
                smartphone=True,
                cv_url_minio=f"recrutamento/candidato_{idx + 1}.pdf",
                estado=random.choice(["nova", "em_analise", "aprovada", "rejeitada"]),
                notas=random.choice([
                    "Perfil com experiência em auditoria retail.",
                    "Disponibilidade limitada na região Sul.",
                    "Boa performance em teste inicial.",
                ]),
            )
            db.add(application)

        study_by_slug: dict[str, Estudo] = {}
        waves_by_slug: dict[str, list[Onda]] = {}
        establishments_by_slug: dict[str, list[Estabelecimento]] = {}
        questionnaires_by_slug: dict[str, Questionario] = {}
        criteria_by_slug: dict[str, list[CriterioGrelha]] = {}
        grids_by_tipo: dict[str, dict[str, Grelha]] = {}  # slug → tipo_visita → Grelha
        photo_rules_created = set()

        for idx, blueprint in enumerate(STUDY_BLUEPRINTS):
            client = client_by_slug[blueprint["slug"]]
            study = Estudo(
                cliente_id=client.id,
                nome=blueprint["study_name"],
                estado="activo",
                tipo_caracterizacao={str(i): field for i, field in enumerate(blueprint["fields"])},
            )
            db.add(study)
            await db.flush()
            study_by_slug[blueprint["slug"]] = study

            db.add(PermissaoEstudo(utilizador_id=coordenador.id, estudo_id=study.id, role="coordenador"))
            db.add(PermissaoEstudo(utilizador_id=validador.id, estudo_id=study.id, role="validador"))
            db.add(PermissaoEstudo(utilizador_id=client_users[idx].id, estudo_id=study.id, role="cliente"))
            db.add(PermissaoEstudo(utilizador_id=analista_user.id, estudo_id=study.id, role="analista"))

            waves = []
            for wave_info in blueprint["waves"]:
                wave = Onda(estudo_id=study.id, label=wave_info["label"])
                db.add(wave)
                waves.append(wave)
            waves_by_slug[blueprint["slug"]] = waves

            for field, label in blueprint["filters"]:
                db.add(FiltroEstudo(estudo_id=study.id, campo=field, label=label))

            for name, canal, region, district, external_code, address, lat, lon in blueprint["establishments"]:
                db.add(
                    Estabelecimento(
                        cliente_id=client.id,
                        id_loja_externo=external_code,
                        nome=name,
                        tipo_canal=canal,
                        regiao=region,
                        responsavel=f"Gestor {district}",
                        latitude=lat,
                        longitude=lon,
                        morada=address,
                        activo=True,
                    )
                )
            await db.flush()
            establishments_by_slug[blueprint["slug"]] = (await db.execute(select(Estabelecimento).where(Estabelecimento.cliente_id == client.id))).scalars().all()

            slug = blueprint["slug"]
            grids_by_tipo[slug] = {}
            multi_cfg = MULTI_GRID_CONFIG.get(slug)
            if multi_cfg:
                # Create structured multi-grid with sections & criteria
                all_criteria: list[CriterioGrelha] = []
                for grid_cfg in multi_cfg:
                    grid = Grelha(
                        estudo_id=study.id,
                        nome=grid_cfg["nome"],
                        versao=1,
                        tipo_visita=grid_cfg["tipo_visita"],
                    )
                    db.add(grid)
                    await db.flush()
                    grids_by_tipo[slug][grid_cfg["tipo_visita"]] = grid
                    for sec_idx, sec_cfg in enumerate(grid_cfg["secoes"]):
                        secao = SecaoGrelha(
                            grelha_id=grid.id,
                            nome=sec_cfg["nome"],
                            ordem=sec_idx,
                            peso_secao=sec_cfg.get("peso"),
                        )
                        db.add(secao)
                        await db.flush()
                        for crit_idx, (crit_label, crit_peso) in enumerate(sec_cfg["criterios"]):
                            c = CriterioGrelha(
                                grelha_id=grid.id,
                                secao_id=secao.id,
                                label=crit_label,
                                peso=crit_peso,
                                tipo="boolean",
                                ordem=crit_idx,
                            )
                            db.add(c)
                            all_criteria.append(c)
                await db.flush()
                criteria_by_slug[slug] = all_criteria
            else:
                # Fallback: single flat grid
                grid = Grelha(estudo_id=study.id, nome=f"Grelha {client.nome}", versao=1, tipo_visita="presencial")
                db.add(grid)
                await db.flush()
                grids_by_tipo[slug]["presencial"] = grid
                criteria: list[CriterioGrelha] = []
                weight = round(100 / len(blueprint["criteria"]), 2)
                for label in blueprint["criteria"]:
                    c = CriterioGrelha(grelha_id=grid.id, label=label, peso=weight, tipo="boolean", ordem=0)
                    db.add(c)
                    criteria.append(c)
                await db.flush()
                criteria_by_slug[slug] = criteria

            for visit_type, values in blueprint["visit_values"].items():
                db.add(TabelaValores(estudo_id=study.id, tipo_visita=visit_type, valor_base=values[0], valor_despesas_max=values[1]))
            # Also register multi-grid visit type values (presencial/drive_through/telefonica)
            multi_visit_extra_values = {
                "presencial": blueprint["visit_values"].get("normal", (25.0, 8.0)),
                "drive_through": (blueprint["visit_values"].get("normal", (25.0, 8.0))[0] * 0.8,
                                  blueprint["visit_values"].get("normal", (25.0, 8.0))[1]),
                "telefonica": (blueprint["visit_values"].get("normal", (25.0, 8.0))[0] * 0.6, 0.0),
            }
            existing_types = set(blueprint["visit_values"].keys())
            for vt, (base, max_exp) in multi_visit_extra_values.items():
                if vt not in existing_types:
                    db.add(TabelaValores(estudo_id=study.id, tipo_visita=vt, valor_base=round(base, 2), valor_despesas_max=round(max_exp, 2)))
            db.add(OrcamentoEstudo(estudo_id=study.id, valor_total=blueprint["budget"], valor_comprometido=round(blueprint["budget"] * 0.71, 2), valor_pago=round(blueprint["budget"] * 0.48, 2), moeda="EUR", notas="Orçamento demo com compromisso parcial e histórico de pagamentos.", actualizado_em=NOW - timedelta(days=5)))
            db.add(ThresholdAcao(estudo_id=study.id, threshold_pontuacao=blueprint["threshold"], tipo_acao="automatico", activo=True))
            db.add(RetencaoDados(estudo_id=study.id, anos_retencao=5, data_eliminacao_programada=TODAY.replace(year=TODAY.year + 5)))

            questionnaire = Questionario(estudo_id=study.id, nome=blueprint["questionnaire"]["nome"], versao=1, json_estrutura=blueprint["questionnaire"]["estrutura"], activo=True, criado_por=admin.id)
            db.add(questionnaire)
            questionnaires_by_slug[blueprint["slug"]] = questionnaire

            training = Formacao(estudo_id=study.id, titulo=blueprint["training"]["titulo"], conteudo_html=f"<h1>{blueprint['training']['titulo']}</h1><p>Conteúdo de formação demo para {client.nome}.</p>", documento_url_minio=f"training/{blueprint['slug']}/manual.pdf", obrigatoria=True)
            db.add(training)
            await db.flush()
            for question, options, correct in blueprint["training"]["perguntas"]:
                db.add(TesteFormacao(formacao_id=training.id, pergunta=question, opcoes={"items": options}, resposta_correta_idx=correct, pontuacao=5))
            certified = analysts[:10] if blueprint["slug"] in {"vodafone", "nos", "fnac"} else analysts[:8]
            for cert_idx, analyst in enumerate(certified):
                db.add(CertificacaoAnalista(analista_id=analyst.id, estudo_id=study.id, certificado_em=TODAY - timedelta(days=120 + cert_idx * 4), valido_ate=TODAY + timedelta(days=210 - cert_idx * 3), estado="activo" if cert_idx < len(certified) - 2 else "expirado"))
                db.add(ResultadoFormacao(analista_id=analyst.id, formacao_id=training.id, pontuacao_obtida=random.randint(7, 10), aprovado=cert_idx < len(certified) - 1, tentativa=1 if cert_idx < 5 else 2, realizado_em=NOW - timedelta(days=90 - cert_idx * 3)))

            photo_key = blueprint["photo_rule"]
            if photo_key not in photo_rules_created:
                photo_rules_created.add(photo_key)
                db.add(TipoVisitaConfig(tipo_visita=photo_key[0], tipo_canal=photo_key[1], fotos_obrigatorias=photo_key[2]))

        await db.flush()

        for slug, study in study_by_slug.items():
            db.add(AuditLog(utilizador_id=admin.id, entidade="Estudo", entidade_id=str(study.id), acao="criado", dados_novos={"nome": study.nome, "estado": study.estado}, ip="127.0.0.1"))

        visit_count = 0
        payment_count = 0
        photo_count = 0
        submission_count = 0
        plan_count = 0
        message_count = 0
        system_message_count = 0
        notification_count = 0
        candidate_count = 0

        for blueprint in STUDY_BLUEPRINTS:
            slug = blueprint["slug"]
            study = study_by_slug[slug]
            waves = waves_by_slug[slug]
            establishments = establishments_by_slug[slug]
            questionary = questionnaires_by_slug[slug]
            criteria = criteria_by_slug[slug]
            study_visit_types = STUDY_VISIT_TYPES.get(slug, ["presencial"])
            study_grids = grids_by_tipo.get(slug, {})

            for wave_index, wave in enumerate(waves):
                wave_info = blueprint["waves"][wave_index]
                current_wave = wave_index == len(waves) - 1
                state_distribution = CURRENT_STATES if current_wave else MATURE_STATES
                for estab_index, establishment in enumerate(establishments):
                    # More visits for richer AI data: 3–4 per establishment in mature waves, 2–3 in current
                    visits_per_establishment = random.randint(2, 3) if current_wave else random.randint(3, 5)
                    for local_visit_idx in range(visits_per_establishment):
                        analyst = analysts[(estab_index + wave_index + local_visit_idx) % len(analysts)]
                        profile = analyst_profile_by_id[analyst.id]
                        state = weighted_choice(state_distribution)
                        # Pick visit type from study-specific pool (deterministic by index)
                        tipo_idx = (estab_index + local_visit_idx + wave_index) % len(study_visit_types)
                        visit_type = study_visit_types[tipo_idx]
                        # Find matching grid
                        active_grid = study_grids.get(visit_type) or next(iter(study_grids.values()), None)
                        # Criteria for score calculation: use grid-specific or all
                        active_criteria = [c for c in criteria if active_grid and c.grelha_id == active_grid.id] or criteria
                        score, score_state = generate_score(profile, wave_index, len(waves), state)
                        planned = random_dt(wave_info["start"], wave_info["end"], 9, 17)
                        lat, lon = visit_coordinates(establishment)
                        visit = Visita(
                            estudo_id=study.id,
                            analista_id=analyst.id,
                            estabelecimento_id=establishment.id,
                            onda_id=wave.id,
                            estado=state,
                            motivo_anulacao=random.choice(["Loja encerrada temporariamente", "Responsável ausente", "Impossibilidade operacional"]) if state == "anulada" else None,
                            tipo_visita=visit_type,
                            grelha_id=active_grid.id if active_grid else None,
                            planeada_em=planned,
                            pontuacao=score,
                            pontuacao_estado=score_state,
                            ia_veredicto="revisao_manual" if score is not None and score < 55 else ("aprovada" if score is not None and score >= 80 else None),
                            ia_mensagem="Score e padrão sugerem revisão manual por anomalia." if score is not None and score < 55 else ("Execução consistente com histórico." if score is not None and score >= 80 else None),
                            ia_critica_em=planned + timedelta(days=1) if score is not None else None,
                            latitude=lat,
                            longitude=lon,
                            activo=True,
                        )
                        if state not in {"nova", "planeada", "anulada"}:
                            visit.realizada_inicio = planned + timedelta(minutes=random.randint(3, 90))
                            visit.realizada_fim = visit.realizada_inicio + timedelta(minutes=random.randint(12, 55))
                            visit.inserida_em = visit.realizada_fim + timedelta(hours=random.randint(1, 36))
                        if state in {"validada", "fechada", "sem_alteracoes"}:
                            visit.validada_em = (visit.inserida_em or planned) + timedelta(days=random.randint(1, 5))
                            visit.validador_id = validador.id
                        db.add(visit)
                        await db.flush()
                        visit_count += 1

                        field_values = build_field_values(blueprint, establishment, wave.label, state, score)
                        for field, value in field_values.items():
                            db.add(CampoVisita(visita_id=visit.id, chave=field, valor=value))
                        db.add(CaracterizacaoCache(visita_id=visit.id, dados=field_values))

                        if score_state == "calculada":
                            for criterion in active_criteria:
                                answer = "1" if score is not None and score >= 72 and random.random() > 0.1 else random.choice(["0", "N/A"])
                                db.add(RespostaVisita(visita_id=visit.id, criterio_id=criterion.id, valor=answer))

                        if state not in {"nova", "planeada", "anulada"} and random.random() > 0.18:
                            db.add(SubmissaoQuestionario(questionario_id=questionary.id, visita_id=visit.id, json_respostas=questionnaire_answers(slug, score), submetido_em=(visit.inserida_em or planned)))
                            submission_count += 1

                        if should_have_photos(blueprint, state):
                            required_photos = blueprint["photo_rule"][2]
                            created_photos = required_photos if score is None else required_photos + (1 if score < 60 and random.random() > 0.5 else 0)
                            for photo_idx in range(created_photos):
                                gps_valid = state not in {"corrigir", "corrigir_email"} and random.random() > 0.12
                                verdict = "rejeitada" if score is not None and score < 55 and photo_idx == 0 else random.choice(["aprovada", "aprovada", "inconclusiva"])
                                db.add(FotoVisita(
                                    visita_id=visit.id,
                                    url_minio=f"demo/photos/{slug}/{visit.id}_{photo_idx + 1}.jpg",
                                    nome_ficheiro=f"{slug}_{visit.id}_{photo_idx + 1}.jpg",
                                    tamanho=120_000 + photo_idx * 21_000,
                                    mime_type="image/jpeg",
                                    latitude_exif=lat,
                                    longitude_exif=lon,
                                    timestamp_exif=(visit.realizada_inicio or planned) + timedelta(minutes=photo_idx * 2),
                                    validada_gps=gps_valid,
                                    validada=gps_valid and verdict != "rejeitada",
                                    ia_veredicto=verdict,
                                    ia_resultado=f'{{"visita": {visit.id}, "veredicto": "{verdict}", "gps": {str(gps_valid).lower()}}}',
                                    ia_critica_em=(visit.realizada_fim or planned) + timedelta(hours=1),
                                ))
                                photo_count += 1

                        if state in {"validada", "fechada", "sem_alteracoes", "corrigida"}:
                            # Fallback order: exact type → normal → first available
                            vv = blueprint["visit_values"]
                            base_value, max_expense = vv.get(visit_type) or vv.get("normal") or next(iter(vv.values()))
                            expense = round(random.uniform(0, max_expense), 2)
                            payment_state = random.choice(["pago", "aprovado", "pendente", "rejeitado"]) if score is not None and score < 50 else random.choice(["pago", "aprovado", "pendente"])
                            db.add(PagamentoVisita(
                                visita_id=visit.id,
                                analista_id=analyst.id,
                                valor_base=base_value,
                                valor_despesas=expense,
                                valor_total=round(base_value + expense, 2),
                                estado=payment_state,
                                aprovado_por=admin.id if payment_state in {"aprovado", "pago"} else None,
                                pago_em=(visit.validada_em or NOW) + timedelta(days=5) if payment_state == "pago" else None,
                                referencia_externa=f"PAY-{slug.upper()}-{visit.id}",
                            ))
                            payment_count += 1

                        if score is not None and score < blueprint["threshold"]:
                            db.add(PlanoAcao(
                                visita_id=visit.id,
                                tipo="automatico" if score < 55 else "ad_hoc",
                                estado=random.choice(["aberto", "em_progresso", "concluido"]),
                                descricao=f"Plano de acção automático para visita com score {score} abaixo do threshold {blueprint['threshold']}.",
                                atribuido_a=coordenador.id,
                                prazo=(visit.validada_em or NOW) + timedelta(days=10),
                                resolucao="Plano concluído com reforço de formação." if score >= 60 else None,
                                criado_por=validador.id,
                                resolvido_em=((visit.validada_em or NOW) + timedelta(days=7)) if score >= 60 and random.random() > 0.5 else None,
                            ))
                            plan_count += 1

                        if state in {"corrigir", "corrigir_email", "para_alteracao", "situacao_especial"}:
                            note = random.choice([
                                "Confirmar coerência entre narrativa e score final.",
                                "Rever evidência fotográfica e justificar GPS.",
                                "Detalhar motivo da excepção operacional no questionário.",
                            ])
                            db.add(MensagemVisita(visita_id=visit.id, remetente_id=validador.id, conteudo=note, lida_por={"ids": [coordenador.id.hex]}))
                            db.add(NotificacaoVisita(visita_id=visit.id, tipo=random.choice(["email", "push"]), destinatario_id=coordenador.id, enviada_em=NOW - timedelta(hours=random.randint(1, 72)), estado=random.choice(["enviada", "pendente"])))
                            message_count += 1
                            notification_count += 1

                        if state in {"nova", "planeada"} and local_visit_idx == 0:
                            candidate_analysts = random.sample(analysts, k=2)
                            for candidate_idx, candidate in enumerate(candidate_analysts):
                                db.add(CandidaturaVisita(analista_id=candidate.id, visita_id=visit.id, estado="aceite" if candidate_idx == 0 and random.random() > 0.4 else random.choice(["pendente", "rejeitada"])))
                                candidate_count += 1

        await db.flush()

        for idx, visit in enumerate((await db.execute(select(Visita).order_by(Visita.id).limit(18))).scalars().all(), start=1):
            if idx % 3 == 0:
                db.add(MensagemSistema(remetente_id=admin.id, destinatario_id=coordenador.id, assunto=f"Revisão visita {visit.id}", corpo="Há visitas com excepções a validar na fila actual.", lida=idx % 2 == 0, criada_em=NOW - timedelta(days=idx)))
                system_message_count += 1

        low_visits = (await db.execute(select(Visita).where(Visita.pontuacao.is_not(None)).order_by(Visita.pontuacao.asc()).limit(6))).scalars().all()
        for idx, visit in enumerate(low_visits):
            db.add(NotificacaoVisita(visita_id=visit.id, tipo="email", destinatario_id=validador.id, enviada_em=NOW - timedelta(hours=idx * 6 + 2), estado="enviada"))
            notification_count += 1

        for idx, analyst in enumerate(analysts[:4]):
            target_estab = establishments_by_slug[STUDY_BLUEPRINTS[idx]["slug"]][idx]
            db.add(ChillingPeriod(analista_id=analyst.id, estabelecimento_id=target_estab.id, meses=3 + idx, inicio_em=TODAY - timedelta(days=idx * 20 + 15), fim_em=TODAY + timedelta(days=70 + idx * 10), activo=True))
        for idx, analyst in enumerate(analysts[4:7]):
            target_estab = establishments_by_slug[STUDY_BLUEPRINTS[idx]["slug"]][idx + 1]
            db.add(BlacklistEstabelecimento(analista_id=analyst.id, estabelecimento_id=target_estab.id, motivo=random.choice(["Conflito de interesse", "Relacionamento prévio com a equipa", "Incumprimento repetido de instruções"]), permanente=idx == 1, criado_por=admin.id))

        direct_conversation = Conversa(nome=None, tipo="direto", criado_por=coordenador.id)
        group_conversation = Conversa(nome="Operação Primavera 2026", tipo="grupo", criado_por=admin.id)
        db.add_all([direct_conversation, group_conversation])
        await db.flush()
        for member in [coordenador, validador]:
            db.add(ConversaMembro(conversa_id=direct_conversation.id, utilizador_id=member.id, ultimo_lido_em=NOW - timedelta(hours=3), adicionado_em=NOW - timedelta(days=12)))
        for member in [admin, coordenador, validador, client_users[0]]:
            db.add(ConversaMembro(conversa_id=group_conversation.id, utilizador_id=member.id, ultimo_lido_em=NOW - timedelta(hours=7 - random.randint(0, 5)), adicionado_em=NOW - timedelta(days=20)))
        chat_messages = [
            (direct_conversation.id, coordenador.id, "Há duas visitas Galp com score anómalo e fotos inconclusivas."),
            (direct_conversation.id, validador.id, "A validação manual fica concluída hoje até às 17h."),
            (group_conversation.id, admin.id, "Dataset demo actualizado para demonstração ao cliente."),
            (group_conversation.id, client_users[0].id, "Necessário destacar casos de melhoria por onda nas próximas reuniões."),
        ]
        for conversation_id, sender_id, text in chat_messages:
            db.add(ChatMensagem(conversa_id=conversation_id, remetente_id=sender_id, texto=text, criada_em=NOW - timedelta(hours=random.randint(1, 48))))

        db.add(ChatSessao(user_id=admin.id, mensagens=[
            {"role": "user", "content": "Gerar resumo das anomalias desta semana.", "ts": (NOW - timedelta(hours=2)).isoformat()},
            {"role": "assistant", "content": "Foram detectadas 6 visitas com score abaixo de 50 e 4 fotos inconclusivas.", "ts": (NOW - timedelta(hours=2) + timedelta(seconds=8)).isoformat()},
            {"role": "user", "content": "Comparar tendência dos analistas em melhoria.", "ts": (NOW - timedelta(hours=1)).isoformat()},
            {"role": "assistant", "content": "Inês Ferreira, João Almeida e Leonor Sousa apresentam tendência positiva entre ondas.", "ts": (NOW - timedelta(hours=1) + timedelta(seconds=5)).isoformat()},
        ], criado_em=NOW - timedelta(days=2), atualizado_em=NOW - timedelta(hours=1)))

        db.add(ExportacaoFinanceira(periodo_inicio=NOW - timedelta(days=90), periodo_fim=NOW, ficheiro_url_minio="exports/financeiro/q1_2026.xlsx", criado_por=admin.id))

        template_count, call_count = await seed_callcenter_only(db, client_by_slug, study_by_slug, admin)

        # ── Shelf Audit data ─────────────────────────────────────────────────────
        # Add shelf audit items for food/retail/energy visits with scored states
        shelf_count = 0
        shelf_products_by_slug = {
            "mcdonalds": [
                ("Big Mac", "5901234123457", 5.30, 3, 2),
                ("McFlurry", "5901234123458", 2.20, 4, 4),
                ("Happy Meal", "5901234123459", 4.50, 6, 5),
                ("McChicken", "5901234123460", 3.80, 5, 5),
                ("Large Fries", "5901234123461", 2.50, 8, 7),
            ],
            "galp": [
                ("Gasolina 95",   None, 1.699, None, None),
                ("Gasóleo Premium", None, 1.749, None, None),
                ("GPL Auto",       None, 0.820, None, None),
                ("Água 1.5L",    "5901234123462", 0.89, 12, 10),
                ("Barra Energética", "5901234123463", 1.20, 8, 6),
            ],
            "fnac": [
                ("Portátil A15", "5901234123464", 599.00, 3, 3),
                ("Headphones Pro", "5901234123465", 149.00, 4, 4),
                ("Cabo USB-C 2m", "5901234123466", 12.99, 15, 12),
                ("Capa Tablet", "5901234123467", 24.99, 8, 6),
                ("Adaptador HDMI", "5901234123468", 9.99, 10, 9),
            ],
        }
        retail_slugs = {"mcdonalds", "galp", "fnac"}
        # Fetch completed visits for retail studies
        for slug in retail_slugs:
            study = study_by_slug[slug]
            products = shelf_products_by_slug[slug]
            retail_visits = (await db.execute(
                select(Visita).where(
                    Visita.estudo_id == study.id,
                    Visita.estado.in_(["validada", "fechada", "inserida", "corrigida"]),
                    Visita.activo == True,
                ).order_by(Visita.id).limit(40)
            )).scalars().all()
            for visit in retail_visits:
                for i, (nome, ean, preco_esp, qty_esp, qty_real) in enumerate(products):
                    conforme = (qty_real is None) or (qty_real >= (qty_esp or 0) * 0.8)
                    db.add(ShelfAuditItem(
                        visita_id=visit.id,
                        produto_nome=nome,
                        ean=ean,
                        preco_esperado=preco_esp,
                        preco_real=round(preco_esp * random.uniform(0.97, 1.03), 3),
                        quantidade_esperada=qty_esp,
                        quantidade_real=qty_real,
                        facings=max(1, (qty_real or 1)),
                        validade=TODAY + timedelta(days=random.randint(30, 180)) if ean else None,
                        conforme=conforme,
                        notas=None if conforme else random.choice([
                            "Produto fora de posição no linear.",
                            "Stock abaixo do mínimo definido.",
                            "Preço em gôndola não actualizado.",
                        ]),
                    ))
                    shelf_count += 1

        # ── Planogram data ────────────────────────────────────────────────────────
        planogram_count = 0
        comparacao_count = 0
        planogram_slugs = {"fnac": "Lineares Tecnologia", "galp": "Loja Conveniência", "mcdonalds": "Balcão Alimentos"}
        for slug, pg_nome in planogram_slugs.items():
            study = study_by_slug[slug]
            pg = Planogram(
                estudo_id=study.id,
                criado_por=admin.id,
                nome=f"Planograma Ref. — {pg_nome}",
                descricao=f"Disposição ideal de produtos para {pg_nome} conforme standard de rede.",
                categoria="loja",
                imagem_url=f"demo/planogramas/{slug}/ref_planogram.jpg",
                imagem_minio_key=f"planogramas/{slug}/ref.jpg",
            )
            db.add(pg)
            await db.flush()
            planogram_count += 1

            # Link planogram to some visited establishments
            pg_visits = (await db.execute(
                select(Visita).join(FotoVisita, FotoVisita.visita_id == Visita.id).where(
                    Visita.estudo_id == study.id,
                    Visita.activo == True,
                    Visita.estado.in_(["validada", "fechada", "inserida"]),
                ).order_by(Visita.id).limit(20)
            )).scalars().all()
            for visit in pg_visits:
                foto = (await db.execute(
                    select(FotoVisita).where(FotoVisita.visita_id == visit.id).limit(1)
                )).scalar_one_or_none()
                compliance = round(random.uniform(55, 98), 2)
                db.add(PlanogramComparacao(
                    planogram_id=pg.id,
                    visita_id=visit.id,
                    foto_id=foto.id if foto else None,
                    score_compliance=compliance,
                    ia_analise=(
                        f"Análise automática de planograma para visita {visit.id}. "
                        f"Conformidade: {compliance}%. "
                        + ("Disposição conforme o standard definido com pequenas variações aceitáveis." if compliance >= 80
                           else "Foram identificadas divergências de posicionamento e ausência de produtos chave.")
                    ),
                    ia_items_corretos={"count": round(len(shelf_products_by_slug[slug]) * compliance / 100)},
                    ia_items_errados={"count": round(len(shelf_products_by_slug[slug]) * (100 - compliance) / 100)},
                    ia_items_faltando={"produtos": ["Stock de produto A" if compliance < 75 else None]},
                    ia_recomendacoes=(
                        "Repor stock e ajustar posicionamento da gôndola central." if compliance < 75
                        else "Manter execução actual; verificar reposição no próximo turno."
                    ),
                    analisado_em=visit.validada_em or NOW - timedelta(days=random.randint(1, 30)),
                ))
                comparacao_count += 1

        await db.flush()

        await db.commit()

        total_establishments = sum(len(establishments) for establishments in establishments_by_slug.values())
        print("=" * 64)
        print("  COMPREHENSIVE SEED COMPLETO")
        print("=" * 64)
        print(f"  Data de referência: {TODAY.isoformat()} | Seed: {SEED}")
        print(f"  Clientes: {len(clients)} | Estudos: {len(study_by_slug)} | Ondas: {sum(len(w) for w in waves_by_slug.values())}")
        print(f"  Estabelecimentos: {total_establishments} | Analistas: {len(analysts)}")
        print(f"  Visitas: {visit_count} | Questionários submetidos: {submission_count} | Fotos: {photo_count}")
        print(f"  Pagamentos: {payment_count} | Planos de ação: {plan_count} | Candidaturas a visitas: {candidate_count}")
        print(f"  Mensagens visita: {message_count} | Mensagens sistema: {system_message_count} | Notificações: {notification_count}")
        print(f"  Templates call center: {template_count} | Chamadas: {call_count}")
        print(f"  Shelf audit items: {shelf_count} | Planogramas: {planogram_count} | Comparações: {comparacao_count}")
        print("  Clientes / Suites (slugs → display):")
        print("    vodafone → ConnectSuite Pro")
        print("    nos      → MediaSuite Plus")
        print("    mcdonalds→ FoodSuite QSR")
        print("    galp     → EnergySuite Retail")
        print("    fnac     → TechRetailSuite")
        print("  Utilizadores criados:")
        print("    admin / Cognira@Admin2026")
        print("    coordenador / Cognira@Coord2026")
        print("    validador / Cognira@Valid2026")
        print("    analista1 / Cognira@Anal2026")
        print("    cliente_vodafone / Cognira@Vodafone26")
        print("    cliente_nos / Cognira@Nos2026")
        print("    cliente_mcd / Cognira@Mcd2026")
        print("    cliente_galp / Cognira@Galp2026")
        print("    cliente_fnac / Cognira@Fnac2026")
        print("=" * 64)


if __name__ == "__main__":
    asyncio.run(seed())