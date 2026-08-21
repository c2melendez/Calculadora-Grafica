"""
Router de health check.

`GET /api/v1/health` -> `{"status": "ok"}`, sin pasar por `MathResponse`
(spec, sección 4: "única excepción al contrato" y sección 9).
"""

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict:
    return {"status": "ok"}
