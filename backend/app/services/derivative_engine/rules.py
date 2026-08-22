"""
app/services/derivative_engine/rules.py — Reglas de derivación (spec,
sección 8.3). Cada regla devuelve SIEMPRE `(derivada, pasos)` — nunca
`None` — porque cualquier sub-término sin regla reconocida cae, dentro de
la propia regla que lo contiene, a un mini-paso genérico calculado con
`sympy.diff()` directo. Esto simplifica la recursión: el motor superior
siempre recibe un resultado utilizable, y la decisión de exponer
`has_detailed_steps: true/false` para la respuesta completa se toma UNA
sola vez, al final, en `engine.py` (verificación holística contra
`sympy.diff(expr_original, var)`).

Prioridad de aplicación (sección 8.3): constante → suma/resta → potencia →
producto → cociente → cadena → función elemental. La implementa
`engine.differentiate`, que llama a estas reglas en ese orden.
"""

from typing import List, Tuple

import sympy
from sympy import (
    Rational,
    acos,
    asin,
    atan,
    cos,
    cosh,
    cot,
    csc,
    exp,
    log,
    sec,
    sin,
    sinh,
    sqrt,
    tan,
    tanh,
)

from app.schemas.responses import Step

# Sección 8.3, tabla ElementaryFunctionRule — 15 funciones (el resumen del
# Módulo 4 en la plantilla dice "12", pero la tabla real de la sección 8.3
# lista 15; se implementa la tabla completa tal cual aparece en la sección
# 8.3, que es la fuente autoritativa — inconsistencia de conteo en el
# resumen, no una contradicción de contenido, así que no bloquea el módulo).
ELEMENTARY_DERIVATIVES = {
    sin: lambda u: cos(u),
    cos: lambda u: -sin(u),
    tan: lambda u: sec(u) ** 2,
    sec: lambda u: sec(u) * tan(u),
    csc: lambda u: -csc(u) * cot(u),
    cot: lambda u: -(csc(u) ** 2),
    asin: lambda u: 1 / sqrt(1 - u**2),
    acos: lambda u: -1 / sqrt(1 - u**2),
    atan: lambda u: 1 / (1 + u**2),
    sinh: lambda u: cosh(u),
    cosh: lambda u: sinh(u),
    tanh: lambda u: 1 / cosh(u) ** 2,
    log: lambda u: 1 / u,
    exp: lambda u: exp(u),
}
_SQRT_DERIVATIVE = lambda u: 1 / (2 * sqrt(u))  # noqa: E731 — tabla, no lógica


def _generic_step(expr: sympy.Expr, var: sympy.Symbol) -> Tuple[sympy.Expr, List[Step]]:
    """Sub-término sin regla reconocida: cálculo directo con SymPy, un paso
    genérico. Nunca falla — es el piso de toda la recursión."""
    derivative = sympy.diff(expr, var)
    step = Step(
        index=0,
        title="Derivada",
        description="Cálculo directo (patrón no reconocido para este sub-término).",
        latex_before=sympy.latex(expr),
        latex_after=sympy.latex(derivative),
    )
    return derivative, [step]


def _is_sqrt(expr: sympy.Expr) -> bool:
    return expr.is_Pow and expr.args[1] == Rational(1, 2)


def constant_rule(expr: sympy.Expr, var: sympy.Symbol):
    """No contiene la variable -> derivada 0."""
    step = Step(
        index=0,
        title="Regla de la constante",
        description=f"'{sympy.latex(expr)}' no depende de {var} → su derivada es 0.",
        rule="ConstantRule",
        latex_before=sympy.latex(expr),
        latex_after="0",
    )
    return sympy.Integer(0), [step]


def sum_rule(expr: sympy.Expr, var: sympy.Symbol):
    """Suma/resta de términos -> deriva término a término."""
    from app.services.derivative_engine.engine import differentiate

    term_results = [differentiate(term, var) for term in expr.args]
    total = sympy.Add(*(deriv for deriv, _ in term_results))

    headline = Step(
        index=0,
        title="Regla de la suma",
        description="Se deriva cada término de la suma por separado.",
        rule="SumRule",
        latex_before=sympy.latex(expr),
        latex_after=sympy.latex(total),
    )
    steps = [headline]
    for _, term_steps in term_results:
        steps.extend(term_steps)
    return total, steps


def power_rule(expr: sympy.Expr, var: sympy.Symbol):
    """`var**n` (base exactamente la variable) -> `n*var**(n-1)`."""
    _base, exponent = expr.args
    derivative = exponent * var ** (exponent - 1)
    step = Step(
        index=0,
        title="Regla de la potencia",
        description=f"d/d{var}[{var}^n] = n·{var}^(n-1), con n = {sympy.latex(exponent)}.",
        rule="PowerRule",
        latex_before=sympy.latex(expr),
        latex_after=sympy.latex(derivative),
    )
    return derivative, [step]


def chain_rule_power(expr: sympy.Expr, var: sympy.Symbol):
    """`(f(x))**n`, base compuesta y exponente constante — caso de
    `ChainRule` con función externa "elevar a n"."""
    from app.services.derivative_engine.engine import differentiate

    base, exponent = expr.args
    inner_deriv, inner_steps = differentiate(base, var)
    derivative = exponent * base ** (exponent - 1) * inner_deriv

    headline = Step(
        index=0,
        title="Regla de la cadena (potencia compuesta)",
        description=(
            "Función externa: elevar a una potencia constante; función interna: "
            f"{sympy.latex(base)}. d/d{var}[f(x)^n] = n·f(x)^(n-1)·f'(x)."
        ),
        rule="ChainRule",
        latex_before=sympy.latex(expr),
        latex_after=sympy.latex(derivative),
    )
    return derivative, [headline, *inner_steps]


def _split_product_and_quotient(expr: sympy.Expr):
    """De un `Mul`, separa un posible factor "denominador" (`Pow(g,-k)`)
    del resto. Devuelve `(numerator_factors, denominator_base_or_None)`."""
    numerator_factors = []
    denominator_base = None
    for factor in expr.args:
        if (
            denominator_base is None
            and factor.is_Pow
            and factor.args[1].is_Number
            and factor.args[1] < 0
        ):
            exponent = factor.args[1]
            if exponent == -1:
                denominator_base = factor.args[0]
            else:
                # Pow(g, -k) con k>1: se mantiene como parte del numerador
                # tratado vía ChainRule/PowerRule (no es un cociente simple
                # f/g de primer orden) — decisión DEDUCIBLE, sección 8.3 no
                # detalla este sub-caso.
                numerator_factors.append(factor)
        else:
            numerator_factors.append(factor)
    return numerator_factors, denominator_base


def product_rule(expr: sympy.Expr, var: sympy.Symbol):
    """`f(x)*g(x) -> f'g + fg'`, con sub-pasos si f/g son compuestas.

    Si `expr` es en realidad un cociente (`Mul` con un factor `Pow(g,-1)`),
    delega en `quotient_rule` — sección 8.3 lista ambas como reglas
    separadas, pero SymPy representa la división como multiplicación por un
    inverso, así que la detección vive aquí.
    """
    from app.services.derivative_engine.engine import differentiate

    numerator_factors, denominator_base = _split_product_and_quotient(expr)

    if denominator_base is not None:
        numerator = sympy.Mul(*numerator_factors) if numerator_factors else sympy.Integer(1)
        return quotient_rule(numerator, denominator_base, expr, var)

    first_factor = numerator_factors[0]
    rest = sympy.Mul(*numerator_factors[1:]) if len(numerator_factors) > 2 else numerator_factors[1]

    f_deriv, f_steps = differentiate(first_factor, var)
    g_deriv, g_steps = differentiate(rest, var)
    derivative = f_deriv * rest + first_factor * g_deriv

    headline = Step(
        index=0,
        title="Regla del producto",
        description="(f·g)' = f'·g + f·g'.",
        rule="ProductRule",
        latex_before=sympy.latex(expr),
        latex_after=sympy.latex(derivative),
    )
    return derivative, [headline, *f_steps, *g_steps]


def quotient_rule(numerator: sympy.Expr, denominator: sympy.Expr, original_expr, var):
    """`f(x)/g(x) -> (f'g - fg')/g**2`."""
    from app.services.derivative_engine.engine import differentiate

    f_deriv, f_steps = differentiate(numerator, var)
    g_deriv, g_steps = differentiate(denominator, var)
    derivative = (f_deriv * denominator - numerator * g_deriv) / denominator**2

    headline = Step(
        index=0,
        title="Regla del cociente",
        description="(f/g)' = (f'·g - f·g')/g².",
        rule="QuotientRule",
        latex_before=sympy.latex(original_expr),
        latex_after=sympy.latex(derivative),
    )
    return derivative, [headline, *f_steps, *g_steps]


def elementary_function_rule(expr: sympy.Expr, var: sympy.Symbol):
    """Función elemental de la tabla, argumento EXACTAMENTE la variable."""
    if _is_sqrt(expr):
        derivative = _SQRT_DERIVATIVE(var)
        label = "sqrt"
    else:
        derivative = ELEMENTARY_DERIVATIVES[type(expr)](var)
        label = type(expr).__name__

    step = Step(
        index=0,
        title="Derivada de función elemental",
        description=f"d/d{var}[{label}({var})] = {sympy.latex(derivative)}.",
        rule="ElementaryFunctionRule",
        latex_before=sympy.latex(expr),
        latex_after=sympy.latex(derivative),
    )
    return derivative, [step]


def chain_rule_function(expr: sympy.Expr, var: sympy.Symbol):
    """Función elemental de la tabla con argumento COMPUESTO -> `ChainRule`
    (`h'(f(x))·f'(x)`), con sub-paso de la derivada interna."""
    from app.services.derivative_engine.engine import differentiate

    inner = expr.args[0]
    if _is_sqrt(expr):
        outer_derivative_at_inner = _SQRT_DERIVATIVE(inner)
        label = "sqrt"
    else:
        outer_derivative_at_inner = ELEMENTARY_DERIVATIVES[type(expr)](inner)
        label = type(expr).__name__

    inner_deriv, inner_steps = differentiate(inner, var)
    derivative = outer_derivative_at_inner * inner_deriv

    headline = Step(
        index=0,
        title="Regla de la cadena",
        description=(
            f"Función externa: {label}; función interna: {sympy.latex(inner)}. "
            "h(f(x))' = h'(f(x))·f'(x)."
        ),
        rule="ChainRule",
        latex_before=sympy.latex(expr),
        latex_after=sympy.latex(derivative),
    )
    return derivative, [headline, *inner_steps]
