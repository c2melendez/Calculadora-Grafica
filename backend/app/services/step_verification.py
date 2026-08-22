"""
app/services/step_verification.py — Verificación de equivalencia matemática
entre "antes" y "después" de un paso del procedimiento (spec, sección 7:
"Verificación de pasos — tres funciones, una por tipo de dato").

No existe una única `verify_step_equivalence` universal — hay TRES funciones
hermanas, cada una para el tipo de objeto que realmente compara:

  1. verify_step_equivalence            -> expresiones escalares
  2. verify_matrix_step_equivalence     -> sympy.Matrix (celda a celda)
  3. verify_equation_step_equivalence   -> ecuaciones (conjunto solución)

Las tres devuelven Literal["VERIFIED", "REJECTED", "INCONCLUSIVE"] con el
mismo significado (sección 7, "Uso común a las tres funciones"):
  VERIFIED     -> el paso se expone tal cual.
  REJECTED     -> el paso nunca se expone; se usa el fallback genérico de la
                  regla correspondiente (sección 8).
  INCONCLUSIVE -> se trata igual que REJECTED para efectos de exposición,
                  pero se registra internamente distinto para depuración.
"""

import itertools
import random
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeoutError
from typing import Dict, List, Literal, Optional, Sequence

import sympy

VerificationResult = Literal["VERIFIED", "REJECTED", "INCONCLUSIVE"]

_NUMERIC_FALLBACK_POINTS = 7
_NUMERIC_RANGE = (-10, 10)
_MAX_RETRIES_PER_POINT = 10
_ABS_TOLERANCE = 1e-8
_LARGE_VALUE_THRESHOLD = 1.0  # a partir de aquí se usa tolerancia relativa

# Guarda de rendimiento DEDUCIBLE (no explícita en la spec): más de esta
# cantidad de soluciones haría que la búsqueda de emparejamiento perfecto en
# verify_equation_step_equivalence (factorial en el número de soluciones)
# arriesgue el presupuesto de tiempo compartido (sección 6). No se conocen
# casos legítimos de `solve` de una sola variable con más soluciones que
# esto dentro del alcance de la Fase 1.
_MAX_SOLUTIONS_FOR_EXACT_MATCHING = 6


def _run_with_timeout(func, timeout_s: float):
    """Ejecuta `func` (sin argumentos) en un hilo separado; devuelve su
    resultado o `None` si excede `timeout_s`.

    Nota (igual que el `# NOTE` de la sección 6 sobre el timeout HTTP): esto
    NO cancela el cálculo de SymPy ya en curso — SymPy no expone puntos de
    interrupción cooperativa — solo se deja de esperar su resultado y se
    continúa con el fallback numérico. El hilo huérfano libera sus recursos
    cuando SymPy termina por su cuenta.
    """
    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(func)
        try:
            return future.result(timeout=timeout_s)
        except FutureTimeoutError:
            return None
        except Exception:
            return None


def _is_invalid_numeric(value: Optional[sympy.Expr]) -> bool:
    """True si `value` no sirve para comparar numéricamente: evaluación
    fallida, no finito, NaN, o SymPy no pudo reducirlo a un número (punto
    singular/indeterminado)."""
    if value is None:
        return True
    if value.has(sympy.zoo, sympy.oo, -sympy.oo, sympy.nan):
        return True
    if not value.is_number:
        return True
    try:
        complex(value)
    except (TypeError, ValueError):
        return True
    return False


def _random_point(free_symbols: Sequence[sympy.Symbol]) -> Dict[sympy.Symbol, float]:
    return {symbol: random.uniform(*_NUMERIC_RANGE) for symbol in free_symbols}


def _values_match(value_a: complex, value_b: complex) -> bool:
    scale = max(abs(value_a), abs(value_b))
    tolerance = _ABS_TOLERANCE if scale < _LARGE_VALUE_THRESHOLD else _ABS_TOLERANCE * scale
    return abs(value_a - value_b) <= tolerance


def _numeric_fallback(
    expr_a: sympy.Expr, expr_b: sympy.Expr, free_symbols: Sequence[sympy.Symbol]
) -> VerificationResult:
    """Paso 3, común a las tres funciones (sección 7): comparar `expr_a` y
    `expr_b` en puntos numéricos aleatorios en [-10, 10] por símbolo libre
    (evaluación única si no hay símbolos libres), evitando puntos singulares
    (reintentar con otro punto si ocurre). Tolerancia 1e-8 absoluta
    (relativa si el valor es grande).
    """
    required_points = 1 if not free_symbols else _NUMERIC_FALLBACK_POINTS
    checked = 0

    while checked < required_points:
        value_a = value_b = None
        for _ in range(_MAX_RETRIES_PER_POINT):
            point = _random_point(free_symbols) if free_symbols else {}
            try:
                value_a = expr_a.evalf(subs=point) if point else expr_a.evalf()
                value_b = expr_b.evalf(subs=point) if point else expr_b.evalf()
            except Exception:
                value_a = value_b = None
                continue
            if _is_invalid_numeric(value_a) or _is_invalid_numeric(value_b):
                value_a = value_b = None
                continue
            break  # punto no singular encontrado para ambas expresiones

        if value_a is None or value_b is None:
            # Tras los reintentos, no se encontró un punto no singular.
            return "INCONCLUSIVE"

        if not _values_match(complex(value_a), complex(value_b)):
            return "REJECTED"

        checked += 1

    return "VERIFIED"


def verify_step_equivalence(
    expr_before: sympy.Expr, expr_after: sympy.Expr, timeout_s: float = 2.0
) -> VerificationResult:
    """Sección 7, función 1 — para expresiones ESCALARES (derivadas,
    integrales, `factor`, pasos algebraicos de `solve` sobre una expresión
    aislada, NUNCA sobre la ecuación completa; para eso está
    `verify_equation_step_equivalence`).

    1. sympy.expand(expr_after - expr_before) == 0 -> VERIFIED.
    2. Si no concluye: sympy.simplify(expr_after - expr_before) == 0, con
       timeout_s interno. Confirma 0 -> VERIFIED. Cuelga/excede timeout_s ->
       pasar a (3).
    3. Fallback numérico (ver `_numeric_fallback`). Todos los puntos
       coinciden -> VERIFIED. Algún punto no coincide -> REJECTED. No se
       puede evaluar numéricamente -> INCONCLUSIVE.
    """
    diff = expr_after - expr_before

    try:
        if sympy.expand(diff) == 0:
            return "VERIFIED"
    except Exception:
        pass  # una expresión que no se puede expandir no descarta el resto

    simplified = _run_with_timeout(lambda: sympy.simplify(diff), timeout_s)
    if simplified is not None:
        try:
            if simplified == 0:
                return "VERIFIED"
        except Exception:
            pass

    free_symbols = sorted(expr_before.free_symbols | expr_after.free_symbols, key=lambda s: s.name)
    return _numeric_fallback(expr_before, expr_after, free_symbols)


def verify_matrix_step_equivalence(
    matrix_before: sympy.Matrix,
    matrix_after: sympy.Matrix,
    expected_transform_description: str,
    timeout_s: float = 2.0,
) -> VerificationResult:
    """Sección 7, función 2 — para pasos de operaciones matriciales
    (suma/resta/multiplicación elemento a elemento, eliminación Gaussiana,
    Gauss-Jordan).

    Compara dos `sympy.Matrix` del mismo tamaño, elemento a elemento, usando
    la misma estrategia de `verify_step_equivalence` (expand -> simplify con
    timeout_s -> fallback numérico) sobre cada celda
    `matrix_after[i,j] - matrix_before[i,j]`. VERIFIED solo si TODAS las
    celdas son VERIFIED individualmente. Si alguna celda es REJECTED ->
    REJECTED. Si ninguna es REJECTED pero alguna es INCONCLUSIVE ->
    INCONCLUSIVE. Nunca usa `Matrix.equals()` como único criterio.

    `expected_transform_description` se recibe por firma (sección 7) pero no
    participa en la comparación matemática celda a celda — es contexto para
    quien llame a esta función (p. ej. logging/depuración de qué
    transformación se intentaba verificar). Decisión DEDUCIBLE, registrada
    en el cierre del Módulo 2A.
    """
    if matrix_before.shape != matrix_after.shape:
        # No explícito en la spec (que asume mismo tamaño) — una
        # transformación que cambia de forma no puede verificarse celda a
        # celda; se trata defensivamente como REJECTED en vez de lanzar.
        return "REJECTED"

    cell_results: List[VerificationResult] = []
    for row in range(matrix_before.rows):
        for col in range(matrix_before.cols):
            cell_results.append(
                verify_step_equivalence(matrix_before[row, col], matrix_after[row, col], timeout_s)
            )

    if any(result == "REJECTED" for result in cell_results):
        return "REJECTED"
    if any(result == "INCONCLUSIVE" for result in cell_results):
        return "INCONCLUSIVE"
    return "VERIFIED"


def verify_equation_step_equivalence(
    eq_before: sympy.Eq, eq_after: sympy.Eq, variable: sympy.Symbol, timeout_s: float = 2.0
) -> VerificationResult:
    """Sección 7, función 3 — para pasos de `solve` que transforman una
    ecuación completa (aislamiento de variable, ej. `ax+b=0` -> `ax=-b`).

    No compara "expresión antes - expresión después" — verifica que el
    CONJUNTO SOLUCIÓN se preserva:
    1. sympy.solve(eq_before, variable) y sympy.solve(eq_after, variable).
    2. Comparar ambos conjuntos con la estrategia escalar (expand -> simplify
       -> fallback numérico) para cada par de soluciones correspondientes,
       COMO CONJUNTOS (no como listas ordenadas — el orden de SymPy puede
       variar para ecuaciones no lineales).
    3. Mismos criterios de salida: todas coinciden -> VERIFIED; alguna no
       coincide -> REJECTED; no se puede resolver o comparar -> INCONCLUSIVE.
    """
    try:
        solutions_before = list(sympy.solve(eq_before, variable))
        solutions_after = list(sympy.solve(eq_after, variable))
    except Exception:
        return "INCONCLUSIVE"

    if len(solutions_before) != len(solutions_after):
        return "REJECTED"

    n = len(solutions_before)
    if n == 0:
        # Ambos lados sin solución (p. ej. una contradicción tipo "2=3" en
        # ambos pasos) -> mismo conjunto solución vacío.
        return "VERIFIED"

    if n > _MAX_SOLUTIONS_FOR_EXACT_MATCHING:
        # Guarda de rendimiento DEDUCIBLE — ver constante arriba.
        return "INCONCLUSIVE"

    # Matriz de comparaciones par a par, reutilizando la función escalar
    # (las soluciones individuales son expresiones escalares).
    pairwise: List[List[VerificationResult]] = [
        [verify_step_equivalence(a, b, timeout_s) for b in solutions_after]
        for a in solutions_before
    ]

    # Buscar un emparejamiento perfecto (conjuntos, no listas) donde TODOS
    # los pares sean VERIFIED.
    for perm in itertools.permutations(range(n)):
        if all(pairwise[i][perm[i]] == "VERIFIED" for i in range(n)):
            return "VERIFIED"

    # No hay emparejamiento perfecto en VERIFIED. Si existe alguno que evite
    # por completo los pares REJECTED (compuesto solo de VERIFIED/
    # INCONCLUSIVE), el desacuerdo es por incertidumbre, no por refutación.
    for perm in itertools.permutations(range(n)):
        if all(pairwise[i][perm[i]] != "REJECTED" for i in range(n)):
            return "INCONCLUSIVE"

    return "REJECTED"
