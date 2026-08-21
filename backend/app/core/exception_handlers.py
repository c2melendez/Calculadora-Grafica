"""
Exception handlers globales (spec, sección 6):

- RequestValidationError -> VALIDATION_ERROR, 422.
- TimeoutError -> TIMEOUT, 200 + success: false.
- Excepción genérica -> INTERNAL_ERROR, 500, mensaje amigable, nunca traceback.

Todos usan `request.state.request_id` (poblado por el middleware en main.py,
ANTES de cualquier validación).

Nota de alcance (DEDUCIBLE, registrada en el cierre del Módulo 1): `GET
/api/v1/health` es la única excepción al contrato `MathResponse` (spec,
sección 4). Si una excepción ocurriera sobre una ruta que no tiene una
`OperationType` mapeada en `PATH_TO_OPERATION` (hoy, en la práctica, solo
`/health`), estos handlers no fuerzan un `OperationType` inventado — devuelven
un JSON de error mínimo en su lugar, para no violar la regla de que los
contratos públicos no se alteran sin autorización.
"""

import time
from typing import Optional

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.config import API_V1_PREFIX, PATH_TO_OPERATION
from app.core.logging import get_logger
from app.schemas.responses import ErrorCode, MathResponse, OperationType


def _operation_for_request(request: Request) -> Optional[OperationType]:
    path = request.url.path
    if path.startswith(API_V1_PREFIX):
        path = path[len(API_V1_PREFIX) :]
    return PATH_TO_OPERATION.get(path)


def _duration_ms(request: Request) -> float:
    start_time = getattr(request.state, "start_time", None)
    if start_time is None:
        return 0.0
    return (time.perf_counter() - start_time) * 1000


def _request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "unknown")


def _error_response(
    request: Request,
    error_code: ErrorCode,
    http_status: int,
    error_message: str,
) -> JSONResponse:
    operation = _operation_for_request(request)
    request_id = _request_id(request)

    if operation is None:
        # Ruta sin OperationType mapeada (p. ej. /health): no forzamos un
        # MathResponse con un valor inventado — devolvemos un error mínimo
        # que preserva request_id sin tocar el contrato MathResponse.
        return JSONResponse(
            status_code=http_status,
            content={
                "success": False,
                "request_id": request_id,
                "error_code": error_code.value,
                "error_message": error_message,
            },
        )

    body = MathResponse(
        success=False,
        operation=operation,
        request_id=request_id,
        has_detailed_steps=False,
        error_code=error_code,
        error_message=error_message,
        duration_ms=_duration_ms(request),
    )
    return JSONResponse(status_code=http_status, content=body.model_dump(mode="json"))


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    get_logger().warning(
        f"request_id={_request_id(request)} event=validation_error errors={exc.errors()}"
    )
    return _error_response(
        request,
        ErrorCode.VALIDATION_ERROR,
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "El payload enviado no cumple el schema esperado.",
    )


async def timeout_exception_handler(request: Request, exc: TimeoutError) -> JSONResponse:
    get_logger().warning(f"request_id={_request_id(request)} event=timeout")
    return _error_response(
        request,
        ErrorCode.TIMEOUT,
        status.HTTP_200_OK,
        "La operación excedió el tiempo máximo permitido.",
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    # Nunca se expone el traceback ni el mensaje crudo de la excepción al
    # cliente (spec, sección 6) — solo se loguea internamente.
    get_logger().error(
        f"request_id={_request_id(request)} event=unhandled_exception "
        f"exception_type={type(exc).__name__}"
    )
    return _error_response(
        request,
        ErrorCode.INTERNAL_ERROR,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        "Ocurrió un error interno inesperado.",
    )
