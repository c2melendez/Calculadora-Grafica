"""
Tests reales del Módulo 3 para `POST /api/v1/simplify`, `/factor`, `/expand`
(spec, secciones 8.2 y 15).
"""

import os

os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _post(path, expression):
    return client.post(f"/api/v1/{path}", json={"expression": expression})


# ---------------------------------------------------------------------------
# Caso obligatorio (sección 15): factor(x**2-4) -> "diferencia de cuadrados"
# ---------------------------------------------------------------------------


def test_factor_difference_of_squares():
    response = _post("factor", "x**2-4")
    body = response.json()
    assert body["success"] is True
    assert body["has_detailed_steps"] is True
    assert len(body["steps"]) == 1
    assert body["steps"][0]["title"] == "Diferencia de cuadrados"
    assert body["result_text"] in ("(x - 2)*(x + 2)", "(x + 2)*(x - 2)")


# ---------------------------------------------------------------------------
# Caso obligatorio (sección 15): expand((x+1)**60) -> COMPLEXITY_LIMIT
# ---------------------------------------------------------------------------


def test_expand_complexity_limit():
    # (x+1)**60 expandido tiene 61 términos pero 298 nodos en el árbol — el
    # criterio real (aclarado por el usuario) es NODOS, no términos.
    response = _post("expand", "(x+1)**60")
    body = response.json()
    assert body["success"] is False
    assert body["error_code"] == "COMPLEXITY_LIMIT"


def test_expand_within_limit_succeeds():
    response = _post("expand", "(x+1)**3")
    body = response.json()
    assert body["success"] is True
    assert body["has_detailed_steps"] is False
    assert "x**3" in body["result_text"]


# ---------------------------------------------------------------------------
# Otros patrones de factor()
# ---------------------------------------------------------------------------


def test_factor_common_factor():
    response = _post("factor", "2*x+4")
    body = response.json()
    assert body["success"] is True
    assert body["has_detailed_steps"] is True
    assert body["steps"][0]["title"] == "Factor común"


def test_factor_trinomial():
    response = _post("factor", "x**2+5*x+6")
    body = response.json()
    assert body["success"] is True
    assert body["has_detailed_steps"] is True
    assert body["steps"][0]["title"] == "Factorización de trinomio"


def test_factor_unrecognized_pattern_is_summary():
    # sin(x)**2 no encaja en ninguno de los tres patrones reconocidos ->
    # resumen, has_detailed_steps: false. sympy.factor() no cambia esta
    # expresión (nada que factorizar).
    response = _post("factor", "sin(x)")
    body = response.json()
    assert body["success"] is True
    assert body["has_detailed_steps"] is False
    assert len(body["steps"]) == 1


# ---------------------------------------------------------------------------
# simplify
# ---------------------------------------------------------------------------


def test_simplify_summary_step():
    response = _post("simplify", "sin(x)**2 + cos(x)**2")
    body = response.json()
    assert body["success"] is True
    assert body["has_detailed_steps"] is False
    assert body["result_text"] == "1"
    assert len(body["steps"]) == 1


# ---------------------------------------------------------------------------
# Parse errors se propagan igual que en /evaluate
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("path", ["simplify", "factor", "expand"])
def test_parse_error_propagates(path):
    response = _post(path, "eval(1)")
    body = response.json()
    assert body["success"] is False
    assert body["error_code"] == "PARSE_ERROR"
    assert body["operation"] == path
