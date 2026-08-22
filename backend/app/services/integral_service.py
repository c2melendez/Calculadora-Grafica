"""
app/services/integral_service.py — `/integral` (spec, sección 8.4,
`IntegralRequest`).

`manualintegrate` primero, con mapeo explícito de reglas a `Step`
(`PowerRule`, `ExpRule`, `TrigRule` — clase base real de SymPy que cubre
`SinRule`/`CosRule`/`Sec2Rule`/`CscCotRule`/`SecTanRule`/`Csc2Rule` vía
`isinstance`—, `URule`, `PartsRule`, `AddRule` con un `Step` por término).
Regla no mapeada -> paso resumen de ese sub-árbol (`ReciprocalRule`,
`ConstantRule`, `ArcsinRule`, etc. — no nombradas en la sección 8.4); si
`manualintegrate` no encuentra NINGUNA técnica (`DontKnowRule`) -> fallback
completo a `sympy.integrate()` directo, `has_detailed_steps: false` y
warning explícito. `ConstantTimesRule`/`AlternativeRule`/`RewriteRule` se
tratan como envoltorios transparentes (no son una "técnica" en sí, solo
bookkeeping interno de SymPy) — se recorre a través de ellos sin generar un
paso propio.
"""

from dataclasses import dataclass
from typing import List, Optional

import sympy
import sympy.integrals.manualintegrate as mi

from app.schemas.responses import Step
from app.services import parsing
from app.services.step_verification import verify_step_equivalence

UNSUPPORTED_INFINITE_BOUNDS_MESSAGE = "Los límites infinitos no están disponibles en esta fase."
# Nota de la sección 5, aplicada literalmente: este mensaje NO debe mencionar
# /integral/improper como alternativa — ese endpoint también responde
# UNSUPPORTED_IN_PHASE_1 (sección 2), así que prometerlo sería peor que no
# ofrecer ninguna alternativa.


class UnsupportedInfiniteBoundsError(ValueError):
    """Límite `oo`/`-oo` en Fase 1 -> `ErrorCode.UNSUPPORTED_IN_PHASE_1`."""


_RULE_LABELS = {
    mi.PowerRule: "Integral de potencia",
    mi.ExpRule: "Integral de exponencial",
}
_TRANSPARENT_WRAPPER_RULES = (mi.ConstantTimesRule, mi.AlternativeRule, mi.RewriteRule)


@dataclass
class IntegralResult:
    input_expr: sympy.Expr
    antiderivative: sympy.Expr
    steps: List[Step]
    has_detailed_steps: bool
    warnings: List[str]
    is_definite: bool
    definite_value: Optional[sympy.Expr] = None


def _local_antiderivative(rule) -> sympy.Expr:
    return sympy.integrate(rule.integrand, rule.variable)


def _label_for_rule(rule) -> Optional[str]:
    if isinstance(rule, mi.TrigRule):
        return "Integral trigonométrica"
    for rule_type, label in _RULE_LABELS.items():
        if isinstance(rule, rule_type):
            return label
    return None


def _unmapped_step(rule) -> List[Step]:
    step = Step(
        index=0,
        title="Integral",
        description="Cálculo directo (regla sin mapeo explícito en la sección 8.4).",
        latex_before=sympy.latex(rule.integrand),
        latex_after=sympy.latex(_local_antiderivative(rule)),
    )
    return [step]


def _walk_rule(rule) -> List[Step]:
    if isinstance(rule, mi.AddRule):
        steps: List[Step] = []
        for substep in rule.substeps:
            steps.extend(_walk_rule(substep))
        return steps

    if isinstance(rule, _TRANSPARENT_WRAPPER_RULES):
        inner = getattr(rule, "substep", None)
        if inner is None:
            alternatives = getattr(rule, "alternatives", None)
            inner = alternatives[0] if alternatives else None
        return _walk_rule(inner) if inner is not None else _unmapped_step(rule)

    if isinstance(rule, mi.URule):
        headline = Step(
            index=0,
            title=f"Sustitución u = {sympy.latex(rule.u_func)}",
            description="Se sustituye u por la parte interna de la expresión.",
            rule="URule",
            latex_before=sympy.latex(rule.integrand),
            latex_after=sympy.latex(_local_antiderivative(rule)),
        )
        return [headline, *_walk_rule(rule.substep)]

    if isinstance(rule, mi.PartsRule):
        headline = Step(
            index=0,
            title="Integración por partes",
            description=(
                f"u = {sympy.latex(rule.u)}, dv = {sympy.latex(rule.dv)}·d{rule.variable}."
            ),
            rule="PartsRule",
            latex_before=sympy.latex(rule.integrand),
            latex_after=sympy.latex(_local_antiderivative(rule)),
        )
        return [headline]

    label = _label_for_rule(rule)
    if label is not None:
        step = Step(
            index=0,
            title=label,
            description=f"Se aplicó la regla: {label.lower()}.",
            rule=type(rule).__name__,
            latex_before=sympy.latex(rule.integrand),
            latex_after=sympy.latex(_local_antiderivative(rule)),
        )
        return [step]

    return _unmapped_step(rule)


def _validate_variable(variable: str) -> sympy.Symbol:
    candidates = parsing.extract_candidate_identifiers(variable)
    if candidates != [variable]:
        raise parsing.ParseSecurityError(f"Nombre de variable inválido: '{variable}'.")
    return sympy.Symbol(variable)


def _parse_bound(raw_bound: str) -> sympy.Expr:
    bound_expr = parsing.parse_expression_tree(raw_bound, allow_equation=False)
    if bound_expr.has(sympy.oo, -sympy.oo):
        raise UnsupportedInfiniteBoundsError(UNSUPPORTED_INFINITE_BOUNDS_MESSAGE)
    return bound_expr


def _compute_indefinite(input_expr: sympy.Expr, var_symbol: sympy.Symbol):
    rule = mi.integral_steps(input_expr, var_symbol)

    if isinstance(rule, mi.DontKnowRule):
        antiderivative = sympy.integrate(input_expr, var_symbol)
        return (
            antiderivative,
            [],
            False,
            [
                "No se encontró una regla de integración mapeada para esta expresión; "
                "se usó el resultado directo de SymPy."
            ],
        )

    steps = _walk_rule(rule)
    antiderivative = mi.manualintegrate(input_expr, var_symbol)

    # Sección 8.4: cada paso verificado comparando la derivada del resultado
    # acumulado contra el integrando original.
    check = verify_step_equivalence(sympy.diff(antiderivative, var_symbol), input_expr)
    if check == "VERIFIED":
        return antiderivative, steps, True, []

    # Red de seguridad: si por algún motivo no verifica, se prefiere el
    # resultado directo de SymPy sin pasos antes que exponer un
    # procedimiento no verificado (sección 8.1, regla 3).
    antiderivative = sympy.integrate(input_expr, var_symbol)
    return antiderivative, [], False, []


def integrate_expression(
    expression: str,
    variable: str,
    lower_bound: Optional[str] = None,
    upper_bound: Optional[str] = None,
) -> IntegralResult:
    input_expr = parsing.parse_expression_tree(expression, allow_equation=False)
    var_symbol = _validate_variable(variable)

    antiderivative, steps, has_detailed_steps, warnings = _compute_indefinite(
        input_expr, var_symbol
    )

    if lower_bound is None and upper_bound is None:
        for index, step in enumerate(steps):
            step.index = index
        return IntegralResult(
            input_expr, antiderivative, steps, has_detailed_steps, warnings, False
        )

    lower_expr = _parse_bound(lower_bound)
    upper_expr = _parse_bound(upper_bound)
    reference = sympy.integrate(input_expr, (var_symbol, lower_expr, upper_expr))

    can_use_ftc_steps = has_detailed_steps and not antiderivative.has(sympy.Integral)
    if can_use_ftc_steps:
        definite_value = sympy.simplify(
            antiderivative.subs(var_symbol, upper_expr)
            - antiderivative.subs(var_symbol, lower_expr)
        )
        if verify_step_equivalence(definite_value, reference) == "VERIFIED":
            ftc_step = Step(
                index=0,
                title="Teorema Fundamental del Cálculo",
                description="∫[a,b] f(x) dx = F(b) - F(a), donde F es la antiderivada.",
                rule="FTC",
                latex_before=f"F({var_symbol}) = {sympy.latex(antiderivative)}",
                latex_after=f"F({sympy.latex(upper_expr)}) - F({sympy.latex(lower_expr)})",
            )
            substitution_step = Step(
                index=0,
                title="Sustitución de límites",
                description="Se sustituyen los límites en la antiderivada y se simplifica.",
                rule="EvaluateBounds",
                latex_before=f"F({sympy.latex(upper_expr)}) - F({sympy.latex(lower_expr)})",
                latex_after=sympy.latex(definite_value),
            )
            all_steps = [*steps, ftc_step, substitution_step]
            for index, step in enumerate(all_steps):
                step.index = index
            return IntegralResult(
                input_expr, antiderivative, all_steps, True, warnings, True, definite_value
            )

    return IntegralResult(input_expr, antiderivative, [], False, [], True, reference)
