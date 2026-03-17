"""Unit tests for estudos_service pure helpers.

No DB required — tests parse_campos and has_study_access in isolation.
"""
import pytest

from app.services.estudos_service import parse_campos, has_study_access


# ── parse_campos ──────────────────────────────────────────────────────────────

def test_parse_campos_none() -> None:
    assert parse_campos(None) == []


def test_parse_campos_empty_dict() -> None:
    assert parse_campos({}) == []


def test_parse_campos_v2_format() -> None:
    stored = {"v2": [{"chave": "nome", "label": "Nome", "tipo": "text", "opcoes": [], "obrigatorio": True}]}
    result = parse_campos(stored)
    assert len(result) == 1
    assert result[0]["chave"] == "nome"
    assert result[0]["obrigatorio"] is True


def test_parse_campos_old_format() -> None:
    stored = {"0": "Nome Loja", "1": "Cidade", "2": "Responsável"}
    result = parse_campos(stored)
    assert len(result) == 3
    # Sorted by index
    assert result[0]["label"] == "Nome Loja"
    assert result[1]["label"] == "Cidade"
    assert result[2]["label"] == "Responsável"
    # Derived chave
    assert result[0]["chave"] == "nome_loja"


def test_parse_campos_old_format_preserves_tipo() -> None:
    stored = {"0": "Score"}
    result = parse_campos(stored)
    assert result[0]["tipo"] == "text"
    assert result[0]["opcoes"] == []
    assert result[0]["obrigatorio"] is False


# ── has_study_access ──────────────────────────────────────────────────────────

class _FakePerm:
    def __init__(self, estudo_id: int):
        self.estudo_id = estudo_id


def test_has_study_access_with_permission() -> None:
    perms = [_FakePerm(1), _FakePerm(2)]
    assert has_study_access(None, 1, perms)


def test_has_study_access_without_permission() -> None:
    perms = [_FakePerm(3)]
    assert not has_study_access(None, 1, perms)


def test_has_study_access_empty_perms() -> None:
    assert not has_study_access(None, 1, [])


def test_has_study_access_none_perms() -> None:
    assert not has_study_access(None, 1, None)
