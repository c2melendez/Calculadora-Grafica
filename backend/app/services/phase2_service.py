"""
app/services/phase2_service.py — passthrough trivial REAL para `/limit` y
`/series` (spec, sección 2: "Sí — sympy.limit()" / "Sí — sympy.series()").

El resto de endpoints de Fase 2 (`/solve/system`, `/inequality`,
`/integral/improper`, `/graph/3d`, `/graph/parametric`,
`/derivative/partial`, `/derivative/implicit`) NO tienen passthrough
trivial — responden `UNSUPPORTED_IN_PHASE_1` directamente desde el router
(`app/routers/phase2.py`), SIN pasar por este servicio ni ejecutar
lógica de SymPy (sección 2, regla exacta para stubs).
"""

from dataclasses import dataclass

import sympy

from app.services import parsing

_DIRECTION_MAP = {"both": "+-", "left": "-", "right": "+"}


@dataclass
class LimitResult:
    input_expr: sympy.Expr
    value: sympy.Expr


@dataclass
class SeriesResult:
    input_expr: sympy.Expr
    value: sympy.Expr


def _validate_variable(variable: str) -> sympy.Symbol:
    candidates = parsing.extract_candidate_identifiers(variable)
    if candidates != [variable]:
        raise parsing.ParseSecurityError(f"Nombre de variable inválido: '{variable}'.")
    return sympy.Symbol(variable)


def compute_limit(expression: str, variable: str, point: str, direction: str) -> LimitResult:
    """Passthrough trivial: `sympy.limit(expr, var, point, dir=...)` directo."""
    input_expr = parsing.parse_expression_tree(expression, allow_equation=False)
    var_symbol = _validate_variable(variable)
    point_expr = parsing.parse_expression_tree(point, allow_equation=False)

    value = sympy.limit(input_expr, var_symbol, point_expr, dir=_DIRECTION_MAP[direction])
    return LimitResult(input_expr, value)


def compute_series(expression: str, variable: str, point: str, order: int) -> SeriesResult:
    """Passthrough trivial: `sympy.series(expr, var, point, n=order+1)` directo,
    sin remover el término `O(...)` — resultado de SymPy tal cual."""
    input_expr = parsing.parse_expression_tree(expression, allow_equation=False)
    var_symbol = _validate_variable(variable)
    point_expr = parsing.parse_expression_tree(point, allow_equation=False)

    value = sympy.series(input_expr, var_symbol, point_expr, n=order + 1)
    return SeriesResult(input_expr, value)
