"""
app/services/evaluate_service.py — `/evaluate` (spec, secciones 3, 5, 6, 7).

`/evaluate`: sin variables libres sin sustituir -> numérico; con variables
libres sin sustituir -> simbólico (sección 6). `angle_unit` solo dentro de
argumentos de funciones trig DIRECTAS (`sin`,`cos`,`tan`,`sec`,`csc`,`cot`);
las inversas siempre en radianes (sección 3). `substitutions` deben parsear
a valores PURAMENTE numéricos (sin variables libres) — si no, `VALIDATION_ERROR`.

`/evaluate` no está en la lista de operaciones con procedimiento paso a paso
(sección 8, 8.2-8.6) — nunca genera `steps` detallados, siempre
`has_detailed_steps: false`.
"""

from dataclasses import dataclass
from typing import Dict, Optional

import sympy
from sympy import cos, cot, csc, pi, sec, sin, tan

from app.services import parsing

_DIRECT_TRIG_FUNCTIONS = (sin, cos, tan, sec, csc, cot)


class SubstitutionValidationError(ValueError):
    """Un valor (o nombre) de `substitutions` no cumple el contrato de la
    sección 5 — se traduce a `ErrorCode.VALIDATION_ERROR`."""


class DomainErrorResult(ValueError):
    """El resultado numérico final no está definido (NaN/infinito/
    indeterminado) — se traduce a `ErrorCode.DOMAIN_ERROR`."""


@dataclass
class EvaluateResult:
    expr: sympy.Expr
    input_expr: sympy.Expr
    is_numeric: bool
    approx_value: Optional[float] = None


def _validate_and_parse_substitutions(
    substitutions: Optional[Dict[str, str]],
) -> Dict[sympy.Symbol, sympy.Expr]:
    if not substitutions:
        return {}

    parsed: Dict[sympy.Symbol, sympy.Expr] = {}
    for name, raw_value in substitutions.items():
        try:
            candidates = parsing.extract_candidate_identifiers(name)
        except parsing.ParseSecurityError as exc:
            raise SubstitutionValidationError(
                f"Nombre de variable inválido en substitutions: '{name}' ({exc})"
            ) from exc
        if candidates != [name]:
            raise SubstitutionValidationError(
                f"Nombre de variable inválido en substitutions: '{name}'."
            )

        try:
            value_expr = parsing.parse_expression_tree(raw_value, allow_equation=False)
        except Exception as exc:
            raise SubstitutionValidationError(
                f"El valor de substitutions['{name}'] no es una expresión numérica "
                f"válida: {exc}"
            ) from exc

        if value_expr.free_symbols:
            free_names = sorted(s.name for s in value_expr.free_symbols)
            raise SubstitutionValidationError(
                f"substitutions['{name}'] debe ser puramente numérico "
                f"(contiene variables libres: {free_names})."
            )
        parsed[sympy.Symbol(name)] = value_expr

    return parsed


def _apply_degree_conversion(expr: sympy.Expr) -> sympy.Expr:
    """Convierte grados -> radianes SOLO dentro de argumentos de funciones
    trig directas (sección 3: "alcance limitado a funciones trig directas").
    """

    def _is_direct_trig(node: sympy.Basic) -> bool:
        return isinstance(node, _DIRECT_TRIG_FUNCTIONS)

    def _convert(node: sympy.Basic) -> sympy.Basic:
        return node.func(node.args[0] * pi / 180)

    return expr.replace(_is_direct_trig, _convert)


def evaluate(
    expression: str,
    angle_unit: str = "rad",
    substitutions: Optional[Dict[str, str]] = None,
) -> EvaluateResult:
    substitution_map = _validate_and_parse_substitutions(substitutions)

    input_expr = parsing.parse_expression_tree(expression, allow_equation=False)
    expr = input_expr

    if angle_unit == "deg":
        expr = _apply_degree_conversion(expr)

    if substitution_map:
        expr = expr.subs(substitution_map)

    if expr.free_symbols:
        # Variables libres sin sustituir -> resultado simbólico (sección 6).
        return EvaluateResult(expr=expr, input_expr=input_expr, is_numeric=False)

    # Sin variables libres sin sustituir -> numérico (sección 6).
    numeric_value = expr.evalf()
    if numeric_value.has(sympy.zoo, sympy.oo, -sympy.oo, sympy.nan):
        raise DomainErrorResult("El resultado no está definido en este dominio.")

    approx = float(numeric_value) if numeric_value.is_real else None

    return EvaluateResult(expr=expr, input_expr=input_expr, is_numeric=True, approx_value=approx)
