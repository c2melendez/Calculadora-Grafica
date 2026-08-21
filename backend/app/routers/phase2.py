"""
app/routers/phase2.py — Fase 2 (spec, sección 2 completa, sección 9).

`/limit` y `/series` tienen passthrough trivial REAL (llaman a
`phase2_service`, que ejecuta SymPy de verdad). El resto de endpoints de
Fase 2 responde `UNSUPPORTED_IN_PHASE_1` INMEDIATAMENTE — sin parsear
expresiones, sin instanciar ningún objeto de SymPy — tal como exige la
sección 2 ("sin ejecutar lógica de SymPy").
"""

import time

import sympy
from fastapi import APIRouter, Request

from app.core.logging import log_request_event
from app.schemas.requests import (
    Graph3DRequest,
    GraphParametricRequest,
    ImplicitDerivativeRequest,
    ImproperIntegralRequest,
    InequalityRequest,
    LimitRequest,
    PartialDerivativeRequest,
    SeriesRequest,
    SolveSystemRequest,
)
from app.schemas.responses import ErrorCode, MathResponse, OperationType, ResultType
from app.services import parsing, phase2_service
from app.services.ast_validator import ComplexityLimitError

router = APIRouter(tags=["phase2"])

_STUB_MESSAGE = (
    "Esta funcionalidad está planificada para una fase futura del proyecto "
    "y todavía no está disponible."
)


def _duration_ms(request: Request) -> float:
    return (time.perf_counter() - request.state.start_time) * 1000


def _error(request: Request, operation: OperationType, error_code: ErrorCode, message: str):
    return MathResponse(
        success=False,
        operation=operation,
        request_id=request.state.request_id,
        has_detailed_steps=False,
        error_code=error_code,
        error_message=message,
        duration_ms=_duration_ms(request),
    )


def _stub_response(request: Request, operation: OperationType) -> MathResponse:
    return _error(request, operation, ErrorCode.UNSUPPORTED_IN_PHASE_1, _STUB_MESSAGE)


# ---------------------------------------------------------------------------
# Passthrough trivial REAL
# ---------------------------------------------------------------------------


@router.post("/limit", response_model=MathResponse)
async def limit(payload: LimitRequest, request: Request) -> MathResponse:
    log_request_event(request.state.request_id, "limit_request", input_text=payload.expression)
    try:
        result = phase2_service.compute_limit(
            payload.expression, payload.variable, payload.point, payload.direction
        )
    except parsing.ParseSecurityError as exc:
        return _error(request, OperationType.LIMIT, ErrorCode.PARSE_ERROR, str(exc))
    except ComplexityLimitError as exc:
        return _error(request, OperationType.LIMIT, ErrorCode.COMPLEXITY_LIMIT, str(exc))

    return MathResponse(
        success=True,
        operation=OperationType.LIMIT,
        request_id=request.state.request_id,
        result_type=ResultType.SCALAR,
        input_text=payload.expression,
        result_text=str(result.value),
        result_latex=sympy.latex(result.value),
        has_detailed_steps=False,
        duration_ms=_duration_ms(request),
    )


@router.post("/series", response_model=MathResponse)
async def series(payload: SeriesRequest, request: Request) -> MathResponse:
    log_request_event(request.state.request_id, "series_request", input_text=payload.expression)
    try:
        result = phase2_service.compute_series(
            payload.expression, payload.variable, payload.point, payload.order
        )
    except parsing.ParseSecurityError as exc:
        return _error(request, OperationType.SERIES, ErrorCode.PARSE_ERROR, str(exc))
    except ComplexityLimitError as exc:
        return _error(request, OperationType.SERIES, ErrorCode.COMPLEXITY_LIMIT, str(exc))

    return MathResponse(
        success=True,
        operation=OperationType.SERIES,
        request_id=request.state.request_id,
        result_type=ResultType.SCALAR,
        input_text=payload.expression,
        result_text=str(result.value),
        result_latex=sympy.latex(result.value),
        has_detailed_steps=False,
        duration_ms=_duration_ms(request),
    )


# ---------------------------------------------------------------------------
# UNSUPPORTED_IN_PHASE_1 — sin ejecutar lógica de SymPy (sección 2)
# ---------------------------------------------------------------------------


@router.post("/solve/system", response_model=MathResponse)
async def solve_system(payload: SolveSystemRequest, request: Request) -> MathResponse:
    log_request_event(request.state.request_id, "solve_system_request")
    return _stub_response(request, OperationType.SOLVE_SYSTEM)


@router.post("/inequality", response_model=MathResponse)
async def inequality(payload: InequalityRequest, request: Request) -> MathResponse:
    log_request_event(request.state.request_id, "inequality_request")
    return _stub_response(request, OperationType.INEQUALITY)


@router.post("/integral/improper", response_model=MathResponse)
async def integral_improper(payload: ImproperIntegralRequest, request: Request) -> MathResponse:
    log_request_event(request.state.request_id, "integral_improper_request")
    return _stub_response(request, OperationType.INTEGRAL_IMPROPER)


@router.post("/graph/3d", response_model=MathResponse)
async def graph_3d(payload: Graph3DRequest, request: Request) -> MathResponse:
    log_request_event(request.state.request_id, "graph_3d_request")
    return _stub_response(request, OperationType.GRAPH_3D)


@router.post("/graph/parametric", response_model=MathResponse)
async def graph_parametric(payload: GraphParametricRequest, request: Request) -> MathResponse:
    log_request_event(request.state.request_id, "graph_parametric_request")
    return _stub_response(request, OperationType.GRAPH_PARAMETRIC)


@router.post("/derivative/partial", response_model=MathResponse)
async def derivative_partial(payload: PartialDerivativeRequest, request: Request) -> MathResponse:
    log_request_event(request.state.request_id, "derivative_partial_request")
    return _stub_response(request, OperationType.DERIVATIVE_PARTIAL)


@router.post("/derivative/implicit", response_model=MathResponse)
async def derivative_implicit(payload: ImplicitDerivativeRequest, request: Request) -> MathResponse:
    log_request_event(request.state.request_id, "derivative_implicit_request")
    return _stub_response(request, OperationType.DERIVATIVE_IMPLICIT)
