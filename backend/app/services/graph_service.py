"""
app/services/graph_service.py — `/graph/2d` (spec, sección 10, `Graph2DRequest`).
"""

from dataclasses import dataclass, field
from typing import List, Optional

import sympy
from sympy import cos, cot, csc, pi, sec, sin, tan

from app.core.config import get_settings
from app.schemas.responses import GraphData, Trace
from app.services import parsing

_DIRECT_TRIG_FUNCTIONS = (sin, cos, tan, sec, csc, cot)

# Dominio por defecto según angle_unit (sección 10: "dominio por defecto
# según angle_unit"; la spec no fija los valores numéricos — decisión
# DEDUCIBLE, documentada en el cierre del Módulo 8): en radianes, [-10,10]
# (coincide con el default de Graph3DRequest, sección 2); en grados, un
# rango más amplio para cubrir al menos dos períodos completos de las
# funciones trig más comunes.
_DEFAULT_DOMAIN_RAD = (-10.0, 10.0)
_DEFAULT_DOMAIN_DEG = (-360.0, 360.0)

# Tope defensivo DEDUCIBLE (no fijado por la spec): evita que 5 expresiones
# a 1000 samples cada una (el máximo permitido por Graph2DRequest.samples)
# disparen 5000 evaluaciones numéricas por request. Si se excede, se reduce
# `samples` proporcionalmente y se marca `points_truncated: true`.
_MAX_TOTAL_POINTS = 2500


class InvalidVariableError(ValueError):
    """La expresión contiene una variable libre distinta de la variable de
    graficación -> `ErrorCode.INVALID_VARIABLE`."""


@dataclass
class GraphResult:
    graph_data: GraphData
    warnings: List[str] = field(default_factory=list)


def _apply_degree_conversion(expr: sympy.Expr) -> sympy.Expr:
    """Igual que en `evaluate_service`/`solve_service`: grados -> radianes
    solo dentro de argumentos de funciones trig DIRECTAS."""

    def _is_direct_trig(node: sympy.Basic) -> bool:
        return isinstance(node, _DIRECT_TRIG_FUNCTIONS)

    def _convert(node: sympy.Basic) -> sympy.Basic:
        return node.func(node.args[0] * pi / 180)

    return expr.replace(_is_direct_trig, _convert)


def _validate_variable(variable: str) -> sympy.Symbol:
    candidates = parsing.extract_candidate_identifiers(variable)
    if candidates != [variable]:
        raise parsing.ParseSecurityError(f"Nombre de variable inválido: '{variable}'.")
    return sympy.Symbol(variable)


def _evaluate_at(expr: sympy.Expr, var_symbol: sympy.Symbol, x_value: float) -> Optional[float]:
    try:
        value = expr.subs(var_symbol, x_value).evalf()
    except Exception:
        return None
    if value.has(sympy.zoo, sympy.oo, -sympy.oo, sympy.nan):
        return None
    if not value.is_real:
        return None
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    if result != result:  # NaN
        return None
    return result


def _percentile(sorted_values: List[float], pct: float) -> float:
    if len(sorted_values) == 1:
        return sorted_values[0]
    rank = (pct / 100) * (len(sorted_values) - 1)
    lower = int(rank)
    upper = min(lower + 1, len(sorted_values) - 1)
    fraction = rank - lower
    return sorted_values[lower] + (sorted_values[upper] - sorted_values[lower]) * fraction


def _compute_y_range(y_values: List[Optional[float]]) -> Optional[List[float]]:
    finite_values = sorted(v for v in y_values if v is not None)
    if not finite_values:
        return None
    low = _percentile(finite_values, 5)
    high = _percentile(finite_values, 95)
    if (high - low) < 1e-10:
        return [-0.1, 0.1]
    return [low, high]


def compute_graph(
    expressions: List[str],
    variable: str,
    x_min: Optional[float],
    x_max: Optional[float],
    samples: Optional[int],
    angle_unit: str = "rad",
) -> GraphResult:
    var_symbol = _validate_variable(variable)
    warnings: List[str] = []

    if (x_min is None) != (x_max is None):
        # Sección 10: "si solo uno de x_min/x_max viene especificado, se
        # ignora con warning" — se usa el dominio completo por defecto.
        warnings.append(
            "Se ignoraron los límites parciales del dominio (x_min/x_max deben "
            "especificarse juntos); se usó el dominio por defecto."
        )
        x_min = x_max = None

    if x_min is None and x_max is None:
        x_min, x_max = _DEFAULT_DOMAIN_DEG if angle_unit == "deg" else _DEFAULT_DOMAIN_RAD

    settings = get_settings()
    requested_samples = samples or settings.graph_2d_default_points

    points_truncated = False
    total_points = requested_samples * len(expressions)
    if total_points > _MAX_TOTAL_POINTS:
        requested_samples = max(2, _MAX_TOTAL_POINTS // len(expressions))
        points_truncated = True
        warnings.append(
            "Se redujo la densidad de muestreo respecto a lo solicitado para "
            "mantener el tiempo de respuesta (sección 6)."
        )

    step = (x_max - x_min) / (requested_samples - 1) if requested_samples > 1 else 0.0
    x_values = [x_min + i * step for i in range(requested_samples)]

    traces: List[Trace] = []
    for expression_text in expressions:
        expr = parsing.parse_expression_tree(expression_text, allow_equation=False)

        extra_symbols = expr.free_symbols - {var_symbol}
        if extra_symbols:
            raise InvalidVariableError(
                f"La expresión '{expression_text}' usa variables distintas de "
                f"'{variable}': {sorted(str(s) for s in extra_symbols)}."
            )

        working_expr = _apply_degree_conversion(expr) if angle_unit == "deg" else expr

        y_values = [_evaluate_at(working_expr, var_symbol, x) for x in x_values]

        none_ratio = sum(1 for y in y_values if y is None) / len(y_values)
        if none_ratio > 0.2:
            warnings.append(
                f"'{expression_text}': más del 20% de los puntos no son reales "
                "(discontinuidades, división por cero, o fuera de dominio)."
            )

        traces.append(Trace(type="line", name=expression_text, x=x_values, y=y_values))

    all_y_values = [y for trace in traces for y in trace.y]
    y_range = _compute_y_range(all_y_values)

    graph_data = GraphData(
        traces=traces,
        x_range=[x_min, x_max],
        y_range=y_range,
        points_truncated=points_truncated,
    )
    return GraphResult(graph_data, warnings)
