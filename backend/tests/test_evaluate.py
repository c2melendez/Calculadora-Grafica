"""
Tests reales del Módulo 2B para `POST /api/v1/evaluate`, vía `TestClient`
(HTTP real sobre la app FastAPI) — casos de la sección 15.
"""

import math
import os

os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")

import pytest
import sympy
from fastapi.testclient import TestClient

from app.main import app
from app.services import evaluate_service

client = TestClient(app)


def _evaluate(**payload):
    return client.post("/api/v1/evaluate", json=payload)


# ---------------------------------------------------------------------------
# Inyecciones -> PARSE_ERROR
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "expression",
    [
        "__import__('os')",
        "().__class__",
        "foo.bar",
        "eval(1)",
        "lambda x: x",
        "Integral(x,x)",
    ],
)
def test_injection_attempts_return_parse_error(expression):
    response = _evaluate(expression=expression)
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is False
    assert body["error_code"] == "PARSE_ERROR"
    assert body["request_id"]


# ---------------------------------------------------------------------------
# Identificador largo
# ---------------------------------------------------------------------------


def test_identifier_too_long_returns_parse_error():
    response = _evaluate(expression="a" * 65 + "+1")
    body = response.json()
    assert body["success"] is False
    assert body["error_code"] == "PARSE_ERROR"


# ---------------------------------------------------------------------------
# Unicode: √4+1 -> sqrt(4)+1 -> 3
# ---------------------------------------------------------------------------


def test_unicode_sqrt_is_normalized_and_evaluated():
    response = _evaluate(expression="√4+1")
    body = response.json()
    assert body["success"] is True
    assert body["result_approx"] == pytest.approx(3.0)


# ---------------------------------------------------------------------------
# Punto decimal / notación científica
# ---------------------------------------------------------------------------


def test_valid_decimal_point():
    response = _evaluate(expression="3.14")
    body = response.json()
    assert body["success"] is True
    assert body["result_approx"] == pytest.approx(3.14)


@pytest.mark.parametrize("expression", [".5", "5.", "1e5"])
def test_invalid_decimal_or_scientific_notation(expression):
    response = _evaluate(expression=expression)
    body = response.json()
    assert body["success"] is False
    assert body["error_code"] == "PARSE_ERROR"


# ---------------------------------------------------------------------------
# Aridad de log/ln
# ---------------------------------------------------------------------------


def test_log_two_args_valid():
    response = _evaluate(expression="log(8,2)")  # log base 2 de 8 = 3
    body = response.json()
    assert body["success"] is True
    assert body["result_approx"] == pytest.approx(3.0)


def test_log_three_args_invalid():
    response = _evaluate(expression="log(x,2,3)")
    body = response.json()
    assert body["success"] is False
    assert body["error_code"] == "PARSE_ERROR"


def test_ln_requires_exactly_one_arg():
    response = _evaluate(expression="ln(8,2)")
    body = response.json()
    assert body["success"] is False
    assert body["error_code"] == "PARSE_ERROR"


# ---------------------------------------------------------------------------
# sin(x) función vs. y(x+1) multiplicación implícita
# ---------------------------------------------------------------------------


def test_sin_as_function_with_substitution():
    response = _evaluate(expression="sin(x)", substitutions={"x": "0"})
    body = response.json()
    assert body["success"] is True
    assert body["result_approx"] == pytest.approx(0.0, abs=1e-9)


def test_y_followed_by_parens_is_implicit_multiplication():
    response = _evaluate(expression="y(x+1)", substitutions={"x": "1", "y": "2"})
    body = response.json()
    assert body["success"] is True
    assert body["result_approx"] == pytest.approx(4.0)


# ---------------------------------------------------------------------------
# Identificadores multi-letra: theta, 2theta, theta*x, xyz
# ---------------------------------------------------------------------------


def test_multiletter_theta_alone():
    response = _evaluate(expression="theta", substitutions={"theta": "2"})
    body = response.json()
    assert body["success"] is True
    assert body["result_approx"] == pytest.approx(2.0)


def test_multiletter_2theta_implicit_multiplication():
    response = _evaluate(expression="2theta", substitutions={"theta": "3"})
    body = response.json()
    assert body["success"] is True
    assert body["result_approx"] == pytest.approx(6.0)


def test_multiletter_theta_times_x_explicit():
    response = _evaluate(expression="theta*x", substitutions={"theta": "2", "x": "3"})
    body = response.json()
    assert body["success"] is True
    assert body["result_approx"] == pytest.approx(6.0)


def test_multiletter_xyz_single_identifier_not_x_times_y_times_z():
    response = _evaluate(expression="xyz", substitutions={"xyz": "5"})
    body = response.json()
    assert body["success"] is True
    assert body["result_approx"] == pytest.approx(5.0)


# ---------------------------------------------------------------------------
# Modo grados con substitutions / inversas siempre en radianes
# ---------------------------------------------------------------------------


def test_degree_mode_with_substitution():
    response = _evaluate(expression="sin(x)", substitutions={"x": "90"}, angle_unit="deg")
    body = response.json()
    assert body["success"] is True
    assert body["result_approx"] == pytest.approx(1.0, abs=1e-9)


def test_degree_mode_direct_literal():
    response = _evaluate(expression="sin(90)", angle_unit="deg")
    body = response.json()
    assert body["success"] is True
    assert body["result_approx"] == pytest.approx(1.0, abs=1e-9)


def test_evaluate_without_substitutions_is_symbolic():
    response = _evaluate(expression="sin(x)")
    body = response.json()
    assert body["success"] is True
    assert body["result_approx"] is None
    assert body["result_text"] == "sin(x)"


def test_inverse_trig_always_radians_regardless_of_angle_unit():
    response = _evaluate(expression="asin(1)", angle_unit="deg")
    body = response.json()
    assert body["success"] is True
    assert body["result_approx"] == pytest.approx(math.pi / 2)


# ---------------------------------------------------------------------------
# Límite de complejidad
# ---------------------------------------------------------------------------


def test_complexity_limit_huge_exponent():
    response = _evaluate(expression="2**100000000")
    body = response.json()
    assert body["success"] is False
    assert body["error_code"] == "COMPLEXITY_LIMIT"


# ---------------------------------------------------------------------------
# substitutions no numéricas -> VALIDATION_ERROR
# ---------------------------------------------------------------------------


def test_substitution_with_free_variable_is_validation_error():
    response = _evaluate(expression="x", substitutions={"x": "y+1"})
    body = response.json()
    assert body["success"] is False
    assert body["error_code"] == "VALIDATION_ERROR"


# ---------------------------------------------------------------------------
# Truncado de result_latex > 10,000 caracteres (sección 4)
# ---------------------------------------------------------------------------


def test_result_latex_truncated_when_too_long(monkeypatch):
    # Expresión con muchos términos simbólicos (no un entero gigante, para no
    # chocar con el límite de conversión int->str de Python) cuyo LaTeX
    # supera los 10,000 caracteres.
    huge_expr = sympy.Add(*(sympy.Symbol(f"x{i}") for i in range(3000)))

    def _fake_evaluate(expression, angle_unit="rad", substitutions=None):
        return evaluate_service.EvaluateResult(
            expr=huge_expr, input_expr=huge_expr, is_numeric=False, approx_value=None
        )

    monkeypatch.setattr("app.routers.evaluate.evaluate_service.evaluate", _fake_evaluate)
    response = _evaluate(expression="1")
    body = response.json()
    assert body["success"] is True
    assert body["result_latex"] is None
    assert any("10,000" in w for w in body["warnings"])


# ---------------------------------------------------------------------------
# Fase 10 (auditoría Fase 0 v2, port de precision-lab-lite): funciones de
# estadística/combinatoria registradas en ALLOWED_FUNCTIONS — antes de esto,
# min/max estaban BLOQUEADOS como identificadores prohibidos y el resto del
# menú "Stat" del teclado (mean/median/mode/range/stdev/variance/mad/mod/
# gcd/lcm/nCr/nPr) ni siquiera existía como función reconocida.
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "expression,expected",
    [
        ("mean(1,2,3)", 2.0),
        ("median(1,2,3,4)", 2.5),
        ("mode(1,2,2,3)", 2.0),
        ("min(5,1,3)", 1.0),
        ("max(5,1,3)", 5.0),
        ("range(1,2,9)", 8.0),
        ("stdev(2,4,6)", 2.0),
        ("variance(2,4,6)", 4.0),
        ("var(2,4,6)", 4.0),  # alias real: la tecla del teclado inserta \mathrm{var}
        ("mad(1,2,3)", 2 / 3),
        ("mod(7,3)", 1.0),
        ("gcd(12,18)", 6.0),
        ("lcm(4,6)", 12.0),
        ("nCr(5,2)", 10.0),
        ("nPr(5,2)", 20.0),
    ],
)
def test_stat_and_combinatorics_functions(expression, expected):
    response = _evaluate(expression=expression)
    body = response.json()
    assert body["success"] is True
    assert body["result_approx"] == pytest.approx(expected)


def test_min_and_max_no_longer_blocked_identifiers():
    # Antes de Fase 10: BLOCKED_IDENTIFIERS incluía "min"/"max" (son
    # builtins de Python) por no estar todavía en ALLOWED_FUNCTIONS —
    # producían PARSE_ERROR, no solo "sin evaluar".
    for expression in ("min(1,2)", "max(1,2)"):
        response = _evaluate(expression=expression)
        body = response.json()
        assert body["success"] is True, f"{expression}: {body}"


def test_stat_functions_stay_symbolic_with_free_variables():
    response = _evaluate(expression="mean(x,1)")
    body = response.json()
    assert body["success"] is True
    assert body["result_approx"] is None  # simbólico, no numérico


def test_stdev_with_single_value_is_parse_error():
    # stdev/variance necesitan al menos 2 valores (decisión documentada en
    # stat_functions.py) — con uno solo, Mean.eval levanta ValueError,
    # que _parse_side envuelve como ParseSecurityError -> PARSE_ERROR.
    response = _evaluate(expression="stdev(5)")
    body = response.json()
    assert body["success"] is False
    assert body["error_code"] == "PARSE_ERROR"
