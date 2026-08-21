"""
app/routers/calculus.py — `POST /derivative` (spec, secciones 4, 5, 8.3, 9).
"""

import time
from typing import Optional

import sympy
from fastapi import APIRouter, Request

from app.core.logging import log_request_event
from app.schemas.requests import DerivativeRequest, IntegralRequest
from app.schemas.responses import ErrorCode, MathResponse, OperationType, ResultType
from app.services import derivative_service, integral_service, parsing
from app.services.ast_validator import ComplexityLimitError

router = APIRouter(tags=["calculus"])

_MAX_RESULT_LATEX_LENGTH = 10_000


def _duration_ms(request: Request) -> float:
    return (time.perf_counter() - request.state.start_time) * 1000


def _error(
    request: Request, operation: OperationType, error_code: ErrorCode, message: str
) -> MathResponse:
    return MathResponse(
        success=False,
        operation=operation,
        request_id=request.state.request_id,
        has_detailed_steps=False,
        error_code=error_code,
        error_message=message,
        duration_ms=_duration_ms(request),
    )


def _safe_latex(expr: sympy.Expr) -> Optional[str]:
    try:
        return sympy.latex(expr)
    except ValueError:
        return None


def _safe_text(expr: sympy.Expr) -> str:
    try:
        return str(expr)
    except ValueError:
        return "(resultado numérico demasiado grande para mostrarse)"


@router.post("/derivative", response_model=MathResponse)
async def derivative(payload: DerivativeRequest, request: Request) -> MathResponse:
    log_request_event(request.state.request_id, "derivative_request", input_text=payload.expression)

    try:
        result = derivative_service.compute_derivative(
            payload.expression, payload.variable, payload.order
        )
    except parsing.ParseSecurityError as exc:
        return _error(request, OperationType.DERIVATIVE, ErrorCode.PARSE_ERROR, str(exc))
    except ComplexityLimitError as exc:
        return _error(request, OperationType.DERIVATIVE, ErrorCode.COMPLEXITY_LIMIT, str(exc))

    warnings = list(result.warnings)
    result_latex = _safe_latex(result.result_expr)
    if result_latex is None:
        warnings.append(
            "Resultado LaTeX omitido: el valor numérico es demasiado grande " "para representarse."
        )
    elif len(result_latex) > _MAX_RESULT_LATEX_LENGTH:
        result_latex = None
        warnings.append("Resultado LaTeX omitido: excede los 10,000 caracteres (sección 4).")

    return MathResponse(
        success=True,
        operation=OperationType.DERIVATIVE,
        request_id=request.state.request_id,
        result_type=ResultType.SCALAR,
        input_text=payload.expression,
        input_latex=_safe_latex(result.input_expr),
        result_latex=result_latex,
        result_text=_safe_text(result.result_expr),
        steps=result.steps,
        has_detailed_steps=result.has_detailed_steps,
        warnings=warnings,
        duration_ms=_duration_ms(request),
    )


@router.post("/integral", response_model=MathResponse)
async def integral(payload: IntegralRequest, request: Request) -> MathResponse:
    log_request_event(request.state.request_id, "integral_request", input_text=payload.expression)

    if (payload.lower_bound is None) != (payload.upper_bound is None):
        # Sección 5: "juntos o ninguno" — validado aquí porque depende de
        # ambos campos a la vez (Pydantic por sí solo no expresa esta regla).
        return _error(
            request,
            OperationType.INTEGRAL,
            ErrorCode.VALIDATION_ERROR,
            "lower_bound y upper_bound deben especificarse juntos o ninguno.",
        )

    try:
        result = integral_service.integrate_expression(
            payload.expression, payload.variable, payload.lower_bound, payload.upper_bound
        )
    except parsing.ParseSecurityError as exc:
        return _error(request, OperationType.INTEGRAL, ErrorCode.PARSE_ERROR, str(exc))
    except ComplexityLimitError as exc:
        return _error(request, OperationType.INTEGRAL, ErrorCode.COMPLEXITY_LIMIT, str(exc))
    except integral_service.UnsupportedInfiniteBoundsError as exc:
        return _error(request, OperationType.INTEGRAL, ErrorCode.UNSUPPORTED_IN_PHASE_1, str(exc))

    warnings = list(result.warnings)

    if result.is_definite:
        display_expr = result.definite_value
    else:
        display_expr = result.antiderivative

    result_latex = _safe_latex(display_expr)
    if result_latex is None:
        warnings.append(
            "Resultado LaTeX omitido: el valor numérico es demasiado grande " "para representarse."
        )
    elif not result.is_definite:
        # Indefinidas: result_latex incluye "+ C" explícito (sección 8.4).
        result_latex = f"{result_latex} + C"

    if result_latex is not None and len(result_latex) > _MAX_RESULT_LATEX_LENGTH:
        result_latex = None
        warnings.append("Resultado LaTeX omitido: excede los 10,000 caracteres (sección 4).")

    result_text = _safe_text(display_expr)
    _too_large_marker = "(resultado numérico demasiado grande para mostrarse)"
    if not result.is_definite and result_text != _too_large_marker:
        result_text = f"{result_text} + C"

    return MathResponse(
        success=True,
        operation=OperationType.INTEGRAL,
        request_id=request.state.request_id,
        result_type=ResultType.SCALAR,
        input_text=payload.expression,
        input_latex=_safe_latex(result.input_expr),
        result_latex=result_latex,
        result_text=result_text,
        steps=result.steps,
        has_detailed_steps=result.has_detailed_steps,
        warnings=warnings,
        duration_ms=_duration_ms(request),
    )
