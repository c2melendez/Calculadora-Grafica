"""
Tests reales del Módulo 6 para `POST /api/v1/solve` (spec, secciones 8.5 y
15): variable ambigua, inferida, identity/contradiction, solución compleja,
angle_unit con/sin trig directa, y confirmación de que el servicio usa
`verify_equation_step_equivalence` (no la escalar) para los pasos.
"""

import os

os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")

import sympy
from fastapi.testclient import TestClient

from app.main import app
from app.services import solve_service

client = TestClient(app)


def _solve(equation, variable=None, angle_unit="rad"):
    payload = {"equation": equation, "angle_unit": angle_unit}
    if variable is not None:
        payload["variable"] = variable
    return client.post("/api/v1/solve", json=payload)


def test_ambiguous_variable_without_hint():
    response = _solve("x+y=0")
    body = response.json()
    assert body["success"] is False
    assert body["error_code"] == "AMBIGUOUS_VARIABLE"


def test_variable_inferred_with_warning():
    response = _solve("2*x+4=0")
    body = response.json()
    assert body["success"] is True
    assert body["has_detailed_steps"] is True
    assert any("inferida" in w for w in body["warnings"])
    assert body["result_data"][0]["text"] == "-2"


def test_identity_2_equals_2():
    response = _solve("2=2")
    body = response.json()
    assert body["success"] is True
    assert body["result_type"] == "identity"
    assert body["has_detailed_steps"] is False


def test_contradiction_2_equals_3():
    response = _solve("2=3")
    body = response.json()
    assert body["success"] is True
    assert body["result_type"] == "contradiction"
    assert body["has_detailed_steps"] is False


def test_complex_solution():
    # x**2 + 1 = 0 -> x = i, -i (discriminante negativo)
    response = _solve("x**2+1=0", variable="x")
    body = response.json()
    assert body["success"] is True
    assert body["has_detailed_steps"] is True
    assert len(body["result_data"]) == 2
    assert all(sol["is_complex"] for sol in body["result_data"])


def test_angle_unit_with_direct_trig():
    # sin(x) = 1/2, angle_unit=deg -> se espera una solución de 30 grados
    response = _solve("sin(x)-1/2=0", variable="x", angle_unit="deg")
    body = response.json()
    assert body["success"] is True
    solutions_text = [sol["text"] for sol in body["result_data"]]
    assert any("30" in text for text in solutions_text)


def test_angle_unit_without_direct_trig_not_converted():
    # 2*x-6=0, angle_unit=deg no debería afectar (no hay trig directa de x)
    response_rad = _solve("2*x-6=0", variable="x", angle_unit="rad")
    response_deg = _solve("2*x-6=0", variable="x", angle_unit="deg")
    assert response_rad.json()["result_data"] == response_deg.json()["result_data"]


def test_solve_uses_equation_verification_not_scalar(monkeypatch):
    calls = []

    original = solve_service.verify_equation_step_equivalence

    def _spy(*args, **kwargs):
        calls.append(args)
        return original(*args, **kwargs)

    monkeypatch.setattr(solve_service, "verify_equation_step_equivalence", _spy)

    result = solve_service.solve_equation("2*x+4=0", "x")

    assert result.has_detailed_steps is True
    assert len(calls) >= 1
    # Cada llamada capturada debe ser con objetos sympy.Eq (ecuaciones), no
    # con la diferencia escalar de dos expresiones.
    for call_args in calls:
        eq_before, eq_after = call_args[0], call_args[1]
        assert isinstance(eq_before, sympy.Eq)
        assert isinstance(eq_after, sympy.Eq)


def test_solve_parse_error_propagates():
    response = _solve("eval(1)=0")
    body = response.json()
    assert body["success"] is False
    assert body["error_code"] == "PARSE_ERROR"
    assert body["operation"] == "solve"
