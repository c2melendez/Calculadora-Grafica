"""
Tests reales del Módulo 4 para `POST /api/v1/derivative` (spec, secciones
8.3 y 15): x**2, sin(x)*x, sin(x**2)*x, orden 2 de x**4,
sec(x)/csc(x)/cot(x), y un caso de colapso.
"""

import os

os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _derivative(expression, variable="x", order=1):
    return client.post(
        "/api/v1/derivative",
        json={"expression": expression, "variable": variable, "order": order},
    )


def test_power_rule_x_squared():
    response = _derivative("x**2")
    body = response.json()
    assert body["success"] is True
    assert body["has_detailed_steps"] is True
    assert body["result_text"] == "2*x"
    assert any(step["rule"] == "PowerRule" for step in body["steps"])


def test_product_rule_sin_x_times_x():
    response = _derivative("sin(x)*x")
    body = response.json()
    assert body["success"] is True
    assert body["has_detailed_steps"] is True
    # d/dx[sin(x)*x] = x*cos(x) + sin(x)
    assert "cos(x)" in body["result_text"]
    assert "sin(x)" in body["result_text"]
    assert any(step["rule"] == "ProductRule" for step in body["steps"])


def test_chain_and_product_rule_sin_x_squared_times_x():
    response = _derivative("sin(x**2)*x")
    body = response.json()
    assert body["success"] is True
    assert body["has_detailed_steps"] is True
    rule_names = {step["rule"] for step in body["steps"]}
    assert "ProductRule" in rule_names
    assert "ChainRule" in rule_names
    # d/dx[x*sin(x**2)] = 2*x**2*cos(x**2) + sin(x**2)
    assert "cos(x**2)" in body["result_text"]


def test_order_two_of_x_to_the_fourth():
    response = _derivative("x**4", order=2)
    body = response.json()
    assert body["success"] is True
    # d²/dx²[x**4] = 12*x**2
    assert body["result_text"] == "12*x**2"


def test_sec_in_elementary_function_table():
    response = _derivative("sec(x)")
    body = response.json()
    assert body["success"] is True
    assert body["has_detailed_steps"] is True
    assert body["result_text"] == "tan(x)*sec(x)"
    step = body["steps"][0]
    assert step["rule"] == "ElementaryFunctionRule"


def test_csc_in_elementary_function_table():
    response = _derivative("csc(x)")
    body = response.json()
    assert body["success"] is True
    assert body["has_detailed_steps"] is True
    # d/dx[csc(x)] = -csc(x)*cot(x)
    assert body["result_text"] == "-cot(x)*csc(x)"


def test_cot_in_elementary_function_table():
    response = _derivative("cot(x)")
    body = response.json()
    assert body["success"] is True
    assert body["has_detailed_steps"] is True
    # d/dx[cot(x)] = -csc(x)**2
    assert body["result_text"] == "-csc(x)**2"


def test_collapse_case_high_order_on_deeply_nested_expression():
    # Una expresión que combina cadena+producto repetidamente, derivada de
    # orden alto: el conteo de pasos acumulados a través de las 5 rondas
    # (order máximo permitido) supera el presupuesto de ~30 pasos y colapsa
    # a cálculo directo.
    response = _derivative("sin(x)*cos(x)*tan(x)*x**2*sec(x)", order=5)
    body = response.json()
    assert body["success"] is True
    assert body["has_detailed_steps"] is False
    assert body["steps"] == []
    assert any("omitió" in w for w in body["warnings"])


def test_order_out_of_range_rejected_by_schema():
    response = _derivative("x**2", order=6)
    body = response.json()
    assert body["success"] is False
    assert body["error_code"] == "VALIDATION_ERROR"


def test_derivative_parse_error_propagates():
    response = _derivative("eval(1)")
    body = response.json()
    assert body["success"] is False
    assert body["error_code"] == "PARSE_ERROR"
    assert body["operation"] == "derivative"
