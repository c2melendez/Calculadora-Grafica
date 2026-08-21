"""
app/routers/evaluate.py — `POST /evaluate` (spec, secciones 3, 4, 5, 6, 7, 9).
"""

import time

import sympy
from fastapi import APIRouter, Request

from app.core.logging import log_request_event
from app.schemas.requests import EvaluateRequest
from app.schemas.responses import ErrorCode, MathResponse, OperationType, ResultType
from app.services import evaluate_service, parsing
from app.services.ast_validator import ComplexityLimitError

router = APIRouter(tags=["evaluate"])

_MAX_RESULT_LATEX_LENGTH = 10_000


def _duration_ms(request: Request) -> float:
    return (time.perf_counter() - request.state.start_time) * 1000


def _error(request: Request, error_code: ErrorCode, message: str) -> MathResponse:
    return MathResponse(
        success=False,
        operation=OperationType.EVALUATE,
        request_id=request.state.request_id,
        has_detailed_steps=False,
        error_code=error_code,
        error_message=message,
        duration_ms=_duration_ms(request),
    )


@router.post("/evaluate", response_model=MathResponse)
async def evaluate(payload: EvaluateRequest, request: Request) -> MathResponse:
    log_request_event(request.state.request_id, "evaluate_request", input_text=payload.expression)

    try:
        result = evaluate_service.evaluate(
            payload.expression, payload.angle_unit, payload.substitutions
        )
    except parsing.ParseSecurityError as exc:
        return _error(request, ErrorCode.PARSE_ERROR, str(exc))
    except ComplexityLimitError as exc:
        return _error(request, ErrorCode.COMPLEXITY_LIMIT, str(exc))
    except evaluate_service.SubstitutionValidationError as exc:
        return _error(request, ErrorCode.VALIDATION_ERROR, str(exc))
    except evaluate_service.DomainErrorResult as exc:
        return _error(request, ErrorCode.DOMAIN_ERROR, str(exc))

    warnings = []
    try:
        result_latex = sympy.latex(result.expr)
    except ValueError:
        # Un entero cuya magnitud excede el límite de conversión int->str de
        # Python (`sys.set_int_max_str_digits`) puede surgir incluso dentro
        # de los límites de la etapa 9 (que acotan el EXPONENTE de entrada,
        # no la magnitud final tras evaluar — ej. 99**10000 tiene ~19,903
        # dígitos aunque el exponente 10000 esté permitido). Hallazgo real
        # del testing del Módulo 2B, no anticipado por la spec. Se trata con
        # el mismo mecanismo que un LaTeX > 10,000 caracteres, en vez de
        # dejar que se propague como un 500 genérico.
        result_latex = None
        warnings.append(
            "Resultado LaTeX omitido: el valor numérico es demasiado grande " "para representarse."
        )
        result_text = "(resultado numérico demasiado grande para mostrarse)"
    else:
        if len(result_latex) > _MAX_RESULT_LATEX_LENGTH:
            result_latex = None
            warnings.append("Resultado LaTeX omitido: excede los 10,000 caracteres (sección 4).")
        try:
            result_text = str(result.expr)
        except ValueError:
            result_text = "(resultado numérico demasiado grande para mostrarse)"

    try:
        input_latex = sympy.latex(result.input_expr)
    except ValueError:
        input_latex = None

    return MathResponse(
        success=True,
        operation=OperationType.EVALUATE,
        request_id=request.state.request_id,
        result_type=ResultType.SCALAR,
        input_text=payload.expression,
        input_latex=input_latex,
        result_latex=result_latex,
        result_text=result_text,
        result_approx=result.approx_value,
        steps=[],
        has_detailed_steps=False,
        warnings=warnings,
        duration_ms=_duration_ms(request),
    )
