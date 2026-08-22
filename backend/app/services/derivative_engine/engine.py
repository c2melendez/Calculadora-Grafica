"""
app/services/derivative_engine/engine.py — Orquestador de
`DerivativeStepEngine` (spec, sección 8.3).

Prioridad de aplicación: constante → suma/resta → potencia → producto →
cociente → cadena → función elemental. `differentiate()` NUNCA falla —
cualquier sub-término no reconocido cae a un mini-paso genérico dentro de
la propia regla que lo contiene (ver `rules._generic_step`), así que el
resultado matemático siempre es correcto (es literalmente `sympy.diff()`
en el peor caso, envuelto en pasos allí donde sí se reconoce un patrón).

`compute()` es el punto de entrada de más alto nivel: aplica
`differentiate()` (posiblemente varias veces, para `order > 1`), colapsa a
cálculo directo si se exceden ~30 pasos acumulados o el presupuesto de
tiempo, y decide `has_detailed_steps` con UNA verificación holística final
(`verify_step_equivalence` del resultado acumulado contra
`sympy.diff(expr_original, var, order)`) — simplificación DEDUCIBLE
documentada en el cierre del Módulo 4: la sección 8.3 describe la
verificación "por regla", pero no detalla la granularidad exacta cuando el
resultado se construye recursivamente; verificar una sola vez el árbol
completo ensamblado es matemáticamente equivalente y evita miles de
llamadas a `verify_step_equivalence` (cada una con su propio `timeout_s`)
para una única derivada.
"""

import time
from typing import List, Tuple

import sympy

from app.core.config import get_settings
from app.schemas.responses import Step
from app.services.derivative_engine import rules
from app.services.step_verification import verify_step_equivalence

STEP_BUDGET = 30
_TIME_BUDGET_FRACTION = 0.8  # fracción de MATH_TIMEOUT_SECONDS (sección 6)


def differentiate(expr: sympy.Expr, var: sympy.Symbol) -> Tuple[sympy.Expr, List[Step]]:
    """Deriva `expr` respecto a `var`, aplicando las reglas en orden de
    prioridad (sección 8.3). Siempre devuelve `(derivada, pasos)`."""
    if var not in expr.free_symbols:
        return rules.constant_rule(expr, var)

    if expr.is_Add:
        return rules.sum_rule(expr, var)

    if expr.is_Pow:
        base, exponent = expr.args
        if base == var and not exponent.has(var):
            return rules.power_rule(expr, var)
        if not exponent.has(var) and exponent.is_Number:
            return rules.chain_rule_power(expr, var)
        # Exponente variable (ej. x**x) — sin regla dedicada en la sección
        # 8.3 -> mini-paso genérico (piso de la recursión).
        return rules._generic_step(expr, var)

    if expr.is_Mul:
        return rules.product_rule(expr, var)

    if rules._is_sqrt(expr) or isinstance(expr, tuple(rules.ELEMENTARY_DERIVATIVES)):
        argument = expr.args[0]
        if argument == var:
            return rules.elementary_function_rule(expr, var)
        return rules.chain_rule_function(expr, var)

    return rules._generic_step(expr, var)


def compute(
    expr: sympy.Expr, var: sympy.Symbol, order: int = 1
) -> Tuple[sympy.Expr, List[Step], bool, List[str]]:
    """Punto de entrada de alto nivel. Devuelve
    `(derivada_final, pasos, has_detailed_steps, warnings)`."""
    settings = get_settings()
    time_budget_seconds = settings.math_timeout_seconds * _TIME_BUDGET_FRACTION
    start_time = time.perf_counter()

    current = expr
    all_steps: List[Step] = []
    collapsed = False

    for _ in range(order):
        derivative, step_batch = differentiate(current, var)
        all_steps.extend(step_batch)
        current = derivative

        if len(all_steps) > STEP_BUDGET:
            collapsed = True
            break
        if (time.perf_counter() - start_time) > time_budget_seconds:
            collapsed = True
            break

    target = sympy.diff(expr, var, order)

    if collapsed:
        return (
            target,
            [],
            False,
            [
                "Se omitió el procedimiento detallado: se superó el límite de "
                f"~{STEP_BUDGET} pasos o el presupuesto de tiempo (sección 8.3)."
            ],
        )

    if verify_step_equivalence(current, target) != "VERIFIED":
        # Red de seguridad (sección 8.1, regla 3): nunca debería ocurrir si
        # las reglas son correctas, pero si ocurre, se prefiere el resultado
        # de sympy.diff() sin pasos antes que exponer un procedimiento no
        # verificado.
        return target, [], False, []

    for index, step in enumerate(all_steps):
        step.index = index

    return current, all_steps, True, []
