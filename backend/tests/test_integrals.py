"""
Tests reales del Módulo 5 para `POST /api/v1/integral` (spec, secciones 8.4
y 15): sin(x) con +C, integral definida (≥3 pasos), fallback por regla no
mapeada, límite `oo` -> mensaje exacto (sin prometer `/integral/improper`).
"""

import os

os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")

from fastapi.testclient import TestClient

from app.main import app
from app.services.integral_service import UNSUPPORTED_INFINITE_BOUNDS_MESSAGE

client = TestClient(app)


def _integral(expression, variable="x", lower_bound=None, upper_bound=None):
    payload = {"expression": expression, "variable": variable}
    if lower_bound is not None:
        payload["lower_bound"] = lower_bound
    if upper_bound is not None:
        payload["upper_bound"] = upper_bound
    return client.post("/api/v1/integral", json=payload)


def test_indefinite_sin_x_includes_plus_c():
    response = _integral("sin(x)")
    body = response.json()
    assert body["success"] is True
    assert body["has_detailed_steps"] is True
    assert body["result_text"].endswith("+ C")
    assert body["result_latex"].endswith("+ C")
    assert any(step["rule"] == "SinRule" for step in body["steps"])


def test_definite_integral_minimum_three_steps():
    response = _integral("x**2", lower_bound="0", upper_bound="2")
    body = response.json()
    assert body["success"] is True
    assert body["has_detailed_steps"] is True
    assert len(body["steps"]) >= 3
    rule_names = [step["rule"] for step in body["steps"]]
    assert "FTC" in rule_names
    assert "EvaluateBounds" in rule_names
    # ∫[0,2] x**2 dx = 8/3
    assert body["result_text"] == "8/3"


def test_fallback_for_unmapped_rule_sin_of_sin():
    # sin(sin(x)) no tiene antiderivada elemental (manualintegrate ->
    # DontKnowRule) -> fallback completo a integrate() directo.
    response = _integral("sin(sin(x))")
    body = response.json()
    assert body["success"] is True
    assert body["has_detailed_steps"] is False
    assert body["steps"] == []
    assert any("directo de SymPy" in w for w in body["warnings"])


def test_infinite_upper_bound_returns_exact_message():
    response = _integral("exp(-x)", lower_bound="0", upper_bound="oo")
    body = response.json()
    assert body["success"] is False
    assert body["error_code"] == "UNSUPPORTED_IN_PHASE_1"
    assert body["error_message"] == UNSUPPORTED_INFINITE_BOUNDS_MESSAGE
    assert "/integral/improper" not in body["error_message"]


def test_infinite_lower_bound_returns_exact_message():
    response = _integral("exp(x)", lower_bound="-oo", upper_bound="0")
    body = response.json()
    assert body["success"] is False
    assert body["error_code"] == "UNSUPPORTED_IN_PHASE_1"
    assert body["error_message"] == UNSUPPORTED_INFINITE_BOUNDS_MESSAGE


def test_only_one_bound_is_validation_error():
    response = _integral("x**2", lower_bound="0")
    body = response.json()
    assert body["success"] is False
    assert body["error_code"] == "VALIDATION_ERROR"


def test_power_rule_labeled():
    response = _integral("x**3")
    body = response.json()
    assert body["success"] is True
    assert body["steps"][0]["title"] == "Integral de potencia"
    assert body["result_text"] == "x**4/4 + C"


def test_add_rule_produces_one_step_per_term():
    response = _integral("x**2 + sin(x)")
    body = response.json()
    assert body["success"] is True
    rule_names = [step["rule"] for step in body["steps"]]
    assert "PowerRule" in rule_names
    assert "SinRule" in rule_names


def test_integral_parse_error_propagates():
    response = _integral("eval(1)")
    body = response.json()
    assert body["success"] is False
    assert body["error_code"] == "PARSE_ERROR"
    assert body["operation"] == "integral"
