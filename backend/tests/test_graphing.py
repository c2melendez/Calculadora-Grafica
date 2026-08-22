"""
Tests reales del Módulo 8 para `POST /api/v1/graph/2d` (spec, secciones 10
y 15): 1/x, sqrt(x) con dominio negativo, función constante, variable
incorrecta, modo grados, solo x_min especificado (warning).
"""

import os

os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")

import math

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _graph(expressions, **kwargs):
    payload = {"expressions": expressions, **kwargs}
    return client.post("/api/v1/graph/2d", json=payload)


def test_one_over_x_has_none_near_asymptote():
    response = _graph(["1/x"], x_min=-5, x_max=5, samples=101)
    body = response.json()
    assert body["success"] is True
    trace = body["graph_data"]["traces"][0]
    # El punto más cercano a x=0 en una malla simétrica con 101 puntos entre
    # -5 y 5 cae exactamente en x=0 (paso 0.1) -> y debe ser None ahí.
    x_values = trace["x"]
    y_values = trace["y"]
    zero_index = min(range(len(x_values)), key=lambda i: abs(x_values[i]))
    assert abs(x_values[zero_index]) < 1e-9
    assert y_values[zero_index] is None


def test_sqrt_x_negative_domain_gives_none():
    response = _graph(["sqrt(x)"], x_min=-10, x_max=10, samples=50)
    body = response.json()
    assert body["success"] is True
    trace = body["graph_data"]["traces"][0]
    for x, y in zip(trace["x"], trace["y"], strict=True):
        if x < 0:
            assert y is None
        elif x > 0:
            assert y is not None
            assert y == pytest_approx(math.sqrt(x))


def pytest_approx(value, tol=1e-6):
    class _Approx:
        def __eq__(self, other):
            return abs(other - value) < tol

    return _Approx()


def test_constant_function_is_valid():
    response = _graph(["5"], x_min=-10, x_max=10, samples=50)
    body = response.json()
    assert body["success"] is True
    trace = body["graph_data"]["traces"][0]
    assert all(y == 5.0 for y in trace["y"])


def test_expression_with_wrong_variable_returns_invalid_variable():
    response = _graph(["y+1"], variable="x", x_min=-5, x_max=5)
    body = response.json()
    assert body["success"] is False
    assert body["error_code"] == "INVALID_VARIABLE"


def test_degree_mode_sin_x():
    response = _graph(["sin(x)"], angle_unit="deg", x_min=0, x_max=360, samples=361)
    body = response.json()
    assert body["success"] is True
    trace = body["graph_data"]["traces"][0]
    # x=90 grados -> sin(90°) = 1
    for x, y in zip(trace["x"], trace["y"], strict=True):
        if abs(x - 90) < 1e-6:
            assert abs(y - 1.0) < 1e-6


def test_only_x_min_specified_triggers_warning_and_default_domain():
    response = _graph(["x"], x_min=2)
    body = response.json()
    assert body["success"] is True
    assert any("dominio" in w for w in body["warnings"])
    # Al ignorarse el límite parcial, se usa el dominio por defecto (más
    # amplio que [2, ...)).
    assert body["graph_data"]["x_range"][0] < 2


def test_graph_parse_error_propagates():
    response = _graph(["eval(1)"])
    body = response.json()
    assert body["success"] is False
    assert body["error_code"] == "PARSE_ERROR"
    assert body["operation"] == "graph_2d"
