"""
Tests reales del Módulo 2B para las 9 etapas de parsing seguro
(`app/services/parsing.py` y `app/services/ast_validator.py`).
"""

import pytest
import sympy

from app.services import ast_validator, parsing

# ---------------------------------------------------------------------------
# Etapa 2: normalización Unicode
# ---------------------------------------------------------------------------


def test_normalize_unicode_pi_and_infinity():
    assert parsing.normalize_unicode("π+∞") == "pi+oo"


def test_normalize_unicode_sqrt_number():
    assert parsing.normalize_unicode("√4+1") == "sqrt(4)+1"


def test_normalize_unicode_sqrt_identifier():
    assert parsing.normalize_unicode("√x") == "sqrt(x)"


def test_normalize_unicode_sqrt_parenthesized():
    assert parsing.normalize_unicode("√(x+1)") == "sqrt(x+1)"


# ---------------------------------------------------------------------------
# Etapa 4: punto decimal y notación científica
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("text", [".5", "5.", "x.", ".x", "3..14"])
def test_invalid_decimal_point_rejected(text):
    with pytest.raises(parsing.ParseSecurityError):
        parsing.validate_decimal_and_reject_scientific(text)


def test_valid_decimal_point_accepted():
    parsing.validate_decimal_and_reject_scientific("3.14")  # no debe lanzar


@pytest.mark.parametrize("text", ["1e5", "3E-2", "5e+10"])
def test_scientific_notation_rejected(text):
    with pytest.raises(parsing.ParseSecurityError):
        parsing.validate_decimal_and_reject_scientific(text)


# ---------------------------------------------------------------------------
# Etapa 5: identificadores
# ---------------------------------------------------------------------------


def test_long_identifier_rejected():
    with pytest.raises(parsing.ParseSecurityError):
        parsing.extract_candidate_identifiers("a" * 65)


def test_identifier_starting_with_underscore_rejected():
    with pytest.raises(parsing.ParseSecurityError):
        parsing.extract_candidate_identifiers("_foo")


def test_dunder_identifier_rejected():
    with pytest.raises(parsing.ParseSecurityError):
        parsing.extract_candidate_identifiers("__import__")


@pytest.mark.parametrize("name", ["eval", "exec", "open", "lambda"])
def test_blocked_builtin_identifier_rejected(name):
    with pytest.raises(parsing.ParseSecurityError):
        parsing.extract_candidate_identifiers(name)


def test_multiletter_identifier_extracted_as_single_token():
    assert parsing.extract_candidate_identifiers("theta") == ["theta"]
    assert parsing.extract_candidate_identifiers("xyz") == ["xyz"]


def test_allowed_function_name_abs_not_blocked():
    # "abs" es builtin de Python Y función permitida (sección 7) — no debe
    # bloquearse pese a estar en dir(builtins).
    assert parsing.extract_candidate_identifiers("abs") == ["abs"]


# ---------------------------------------------------------------------------
# Etapa 6: aridad de log/ln
# ---------------------------------------------------------------------------


def test_log_arity_one_or_two_ok():
    parsing._validate_call_arity("log(8)")
    parsing._validate_call_arity("log(8,2)")


def test_log_arity_three_rejected():
    with pytest.raises(parsing.ParseSecurityError):
        parsing._validate_call_arity("log(x,2,3)")


def test_ln_arity_must_be_exactly_one():
    parsing._validate_call_arity("ln(8)")
    with pytest.raises(parsing.ParseSecurityError):
        parsing._validate_call_arity("ln(8,2)")


# ---------------------------------------------------------------------------
# Etapa 7 (orquestador completo) — inyecciones y ejemplos de la sección 7/15
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "malicious_text",
    [
        "__import__('os')",
        "().__class__",
        "foo.bar",
        "foo()",
        "eval(1)",
        "exec(1)",
        "open(1)",
        "lambda x: x",
        "Integral(x,x)",
        "Derivative(x**2,x)",
    ],
)
def test_injection_attempts_rejected(malicious_text):
    with pytest.raises(parsing.ParseSecurityError):
        parsing.parse_expression_tree(malicious_text)


def test_function_vs_implicit_multiplication():
    # sin(x): función reconocida.
    expr_sin = parsing.parse_expression_tree("sin(x)")
    assert isinstance(expr_sin, sympy.sin)

    # y(x+1): "y" no es una función permitida -> multiplicación implícita.
    expr_y = parsing.parse_expression_tree("y(x+1)")
    x, y = sympy.symbols("x y")
    assert sympy.expand(expr_y - y * (x + 1)) == 0


def test_multiletter_identifier_priority_over_implicit_multiplication():
    theta = sympy.Symbol("theta")
    expr = parsing.parse_expression_tree("2theta")
    assert sympy.expand(expr - 2 * theta) == 0


# ---------------------------------------------------------------------------
# Etapa 9: límites de complejidad
# ---------------------------------------------------------------------------


def test_complexity_limit_large_exponent():
    with pytest.raises((parsing.ParseSecurityError, ast_validator.ComplexityLimitError)):
        parsing.parse_expression_tree("2**100000000")


def test_reasonable_expression_within_complexity_limits():
    expr = parsing.parse_expression_tree("x**2 + 2*x + 1")
    assert expr is not None
