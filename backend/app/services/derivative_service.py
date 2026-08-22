"""
app/services/derivative_service.py — `/derivative` (spec, sección 8.3,
`DerivativeRequest`).
"""

from dataclasses import dataclass
from typing import List

import sympy

from app.schemas.responses import Step
from app.services import parsing
from app.services.derivative_engine import engine


@dataclass
class DerivativeResult:
    input_expr: sympy.Expr
    result_expr: sympy.Expr
    steps: List[Step]
    has_detailed_steps: bool
    warnings: List[str]


def compute_derivative(expression: str, variable: str, order: int) -> DerivativeResult:
    input_expr = parsing.parse_expression_tree(expression, allow_equation=False)

    # La variable de derivación pasa por la misma validación de
    # identificador que cualquier variable de la expresión (sección 7,
    # etapa 5) — reutilizamos extract_candidate_identifiers, igual que ya
    # se hace para los nombres de `substitutions` en evaluate_service.
    candidates = parsing.extract_candidate_identifiers(variable)
    if candidates != [variable]:
        raise parsing.ParseSecurityError(f"Nombre de variable inválido: '{variable}'.")

    var_symbol = sympy.Symbol(variable)
    result_expr, steps, has_detailed_steps, warnings = engine.compute(input_expr, var_symbol, order)

    return DerivativeResult(
        input_expr=input_expr,
        result_expr=result_expr,
        steps=steps,
        has_detailed_steps=has_detailed_steps,
        warnings=warnings,
    )
