"""
app/services/algebra_service.py — `/simplify`, `/factor`, `/expand`
(spec, sección 8.2).

- `simplify`/`expand`: un paso resumen antes/después, `has_detailed_steps:
  false`. `expand()` reutiliza el límite de nodos de `check_complexity_limits`
  (etapa 9, sección 7) sobre el RESULTADO expandido -> `COMPLEXITY_LIMIT`
  (evita explosión combinatoria, ej. `(x+1)**60`). Aclaración recibida del
  usuario durante el Módulo 3: la sección 8.2 dice ">200 términos", pero
  `(x+1)**60` tiene 61 términos y 298 nodos — el criterio real es NODOS del
  árbol, no términos (ver nota en `expand_expression`).
- `factor`: compara entrada vs. `sympy.factor()` y reconoce patrones
  ("Diferencia de cuadrados", "Factor común", "Factorización de trinomio");
  cualquier otro caso -> resumen, `has_detailed_steps: false`.
- Todo paso candidato pasa por `verify_step_equivalence` (escalar) antes de
  incluirse (sección 8.1, regla 5) — si la verificación no da `VERIFIED`,
  se degrada a paso resumen en vez de bloquear la respuesta.
"""

from dataclasses import dataclass
from typing import List, Optional

import sympy

from app.schemas.responses import Step
from app.services import parsing
from app.services.ast_validator import check_complexity_limits
from app.services.step_verification import verify_step_equivalence


@dataclass
class AlgebraResult:
    input_expr: sympy.Expr
    result_expr: sympy.Expr
    steps: List[Step]
    has_detailed_steps: bool
    pattern_name: Optional[str] = None


def _summary_step(input_expr: sympy.Expr, result_expr: sympy.Expr, title: str) -> Step:
    return Step(
        index=0,
        title=title,
        description=f"Resultado de aplicar {title.lower()}.",
        latex_before=sympy.latex(input_expr),
        latex_after=sympy.latex(result_expr),
    )


def simplify_expression(expression: str) -> AlgebraResult:
    input_expr = parsing.parse_expression_tree(expression, allow_equation=False)
    result_expr = sympy.simplify(input_expr)
    step = _summary_step(input_expr, result_expr, "Simplificación")
    return AlgebraResult(input_expr, result_expr, [step], has_detailed_steps=False)


def expand_expression(expression: str) -> AlgebraResult:
    input_expr = parsing.parse_expression_tree(expression, allow_equation=False)
    result_expr = sympy.expand(input_expr)

    # Aclaración recibida del usuario para el Módulo 3 (contradicción real
    # detectada durante el testing: la sección 8.2 dice ">200 términos", pero
    # el caso de prueba obligatorio `expand((x+1)**60)` solo supera 200 si se
    # cuenta por NODOS del árbol — `(x+1)**60` expandido tiene 61 términos
    # pero 298 nodos. Se reutiliza literalmente `check_complexity_limits`
    # (mismo criterio de la etapa 9, sección 7) sobre el resultado
    # expandido, en vez de duplicar un umbral de "términos" aparte.
    check_complexity_limits(result_expr)

    step = _summary_step(input_expr, result_expr, "Expansión")
    return AlgebraResult(input_expr, result_expr, [step], has_detailed_steps=False)


def _is_conjugate_binomial_pair(factor_a: sympy.Expr, factor_b: sympy.Expr) -> bool:
    """`(a+b)` y `(a-b)`: su suma y su diferencia colapsan cada una a un
    único término (`2a` y `2b` respectivamente)."""
    if not (factor_a.is_Add and factor_b.is_Add):
        return False
    if len(factor_a.args) != 2 or len(factor_b.args) != 2:
        return False
    sum_terms = sympy.expand(factor_a + factor_b).as_ordered_terms()
    diff_terms = sympy.expand(factor_a - factor_b).as_ordered_terms()
    return len(sum_terms) == 1 and len(diff_terms) == 1


def _detect_factor_pattern(input_expr: sympy.Expr, factored: sympy.Expr) -> Optional[str]:
    """Sección 8.2: identifica el patrón de factorización, si aplica."""
    if not factored.is_Mul:
        return None

    add_factors = [factor for factor in factored.args if factor.is_Add]
    non_add_factors = [factor for factor in factored.args if not factor.is_Add]

    if len(add_factors) == 2 and not non_add_factors:
        factor_a, factor_b = add_factors
        if _is_conjugate_binomial_pair(factor_a, factor_b):
            return "Diferencia de cuadrados"
        if input_expr.is_Add and len(input_expr.args) == 3:
            return "Factorización de trinomio"
        return None

    if len(add_factors) == 1 and non_add_factors:
        extracted = sympy.Mul(*non_add_factors)
        if extracted not in (sympy.Integer(1), sympy.Integer(-1)):
            return "Factor común"

    return None


def factor_expression(expression: str) -> AlgebraResult:
    input_expr = parsing.parse_expression_tree(expression, allow_equation=False)
    factored = sympy.factor(input_expr)

    pattern_name = _detect_factor_pattern(input_expr, factored)

    if pattern_name is not None:
        # Sección 8.1, regla 5: todo paso candidato se verifica antes de
        # incluirse. Si por alguna razón no da VERIFIED, se degrada a
        # resumen en vez de bloquear la respuesta (sección 8.1, regla 3).
        if verify_step_equivalence(input_expr, factored) != "VERIFIED":
            pattern_name = None

    if pattern_name is not None:
        step = Step(
            index=0,
            title=pattern_name,
            description=f"Se identificó el patrón: {pattern_name.lower()}.",
            rule=pattern_name,
            latex_before=sympy.latex(input_expr),
            latex_after=sympy.latex(factored),
        )
        has_detailed_steps = True
    else:
        step = _summary_step(input_expr, factored, "Factorización")
        has_detailed_steps = False

    return AlgebraResult(
        input_expr,
        factored,
        [step],
        has_detailed_steps=has_detailed_steps,
        pattern_name=pattern_name,
    )
