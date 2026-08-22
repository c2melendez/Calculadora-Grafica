"""
Tests del Módulo 1: el servidor arranca y GET /api/v1/health responde
{"status": "ok"} (spec, sección 4 y 9; entregable explícito del Módulo 1).

Nota: este archivo no está listado por nombre en la sección 12 de la spec
(que enumera test_parsing.py, test_evaluate.py, etc., para módulos
posteriores) — se añade aquí porque el propio Módulo 1 pide explícitamente
un test de arranque/health. Decisión DEDUCIBLE, declarada en el cierre.
"""

import os

os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_ok():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_includes_request_id_header():
    response = client.get("/api/v1/health")
    assert "X-Request-ID" in response.headers


def test_app_starts_without_error():
    # Si TestClient(app) no lanzó excepción arriba, la app ya arrancó
    # correctamente (lifecycle de FastAPI/Starlette se ejecuta al construir
    # el cliente). Este test deja esa aserción explícita en la suite.
    assert app.title == "Calculadora Científica Web"
