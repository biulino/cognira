"""Unit tests for the state machine — transition rules."""
import pytest

from app.services.state_machine import TRANSITIONS


# ── Valid transitions from TRANSITIONS dict ───────────────────────────────────

def test_all_states_have_transitions() -> None:
    """TRANSITIONS must define at least one target for every known state."""
    assert len(TRANSITIONS) > 0
    for state, targets in TRANSITIONS.items():
        assert len(targets) > 0, f"State '{state}' has no allowed transitions"


def test_nova_can_reach_planeada() -> None:
    assert "planeada" in TRANSITIONS.get("nova", {})


def test_planeada_can_reach_inserida() -> None:
    assert "inserida" in TRANSITIONS.get("planeada", {})


def test_inserida_can_be_validada() -> None:
    assert "validada" in TRANSITIONS.get("inserida", {})


def test_inserida_can_be_corrigida() -> None:
    assert "corrigir" in TRANSITIONS.get("inserida", {})


def test_validada_can_be_fechada() -> None:
    assert "fechada" in TRANSITIONS.get("validada", {})


def test_fechada_is_terminal() -> None:
    """Once fechada, there are no further transitions."""
    assert "fechada" not in TRANSITIONS, "'fechada' must be a terminal state"


def test_anulada_is_terminal() -> None:
    """Once anulada, there are no further transitions."""
    assert "anulada" not in TRANSITIONS, "'anulada' must be a terminal state"


# ── Role restrictions ────────────────────────────────────────────────────────

def test_only_admin_coordenador_close_visit() -> None:
    """Fechamento (validada → fechada) restricted to admin/coordenador."""
    roles = TRANSITIONS.get("validada", {}).get("fechada", [])
    assert "admin" in roles
    assert "coordenador" in roles


def test_analista_can_insert_visit() -> None:
    """Analista must be allowed to mark a visit as inserida."""
    roles = TRANSITIONS.get("planeada", {}).get("inserida", [])
    assert "analista" in roles


def test_analista_cannot_validate() -> None:
    """Analista must NOT be allowed to validate (inserida → validada)."""
    roles = TRANSITIONS.get("inserida", {}).get("validada", [])
    assert "analista" not in roles


# ── Transition coverage: every target state appears at least once ─────────────

def test_all_target_states_reachable() -> None:
    """Every target state in TRANSITIONS must be reachable from some starting state."""
    reachable = set()
    for targets in TRANSITIONS.values():
        reachable.update(targets.keys())
    for expected in ("planeada", "inserida", "validada", "fechada", "anulada", "corrigir"):
        assert expected in reachable, f"State '{expected}' is unreachable"

