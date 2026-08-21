"""
Contratos públicos de respuesta de la API — definidos UNA SOLA VEZ.

Fuente: spec_calculadora_cientifica_v9.md, sección 4.

Regla de proyecto (Mensaje 0, punto 3): estos contratos no se redefinen en
otro archivo. No se eliminan campos públicos existentes, no se renombran, no
se cambia su tipo o semántica sin autorización explícita. Ampliaciones
siempre retrocompatibles.
"""

from enum import Enum
from typing import Dict, List, Optional, Union

from pydantic import BaseModel


class OperationType(str, Enum):
    EVALUATE = "evaluate"
    SIMPLIFY = "simplify"
    FACTOR = "factor"
    EXPAND = "expand"
    SOLVE = "solve"
    DERIVATIVE = "derivative"
    INTEGRAL = "integral"
    MATRIX_OPERATION = "matrix_operation"
    MATRIX_DETERMINANT = "matrix_determinant"
    MATRIX_INVERSE = "matrix_inverse"
    GRAPH_2D = "graph_2d"
    SOLVE_SYSTEM = "solve_system"
    INEQUALITY = "inequality"
    LIMIT = "limit"
    SERIES = "series"
    MATRIX_EIGEN = "matrix_eigen"
    INTEGRAL_IMPROPER = "integral_improper"
    GRAPH_3D = "graph_3d"
    GRAPH_PARAMETRIC = "graph_parametric"
    DERIVATIVE_PARTIAL = "derivative_partial"
    DERIVATIVE_IMPLICIT = "derivative_implicit"


class MatrixOpKind(str, Enum):
    ADD = "add"
    SUBTRACT = "subtract"
    MULTIPLY = "multiply"


class ResultType(str, Enum):
    SCALAR = "scalar"
    EQUATION_SOLUTIONS = "equation_solutions"
    MATRIX = "matrix"
    BOOLEAN = "boolean"
    GRAPH = "graph"
    IDENTITY = "identity"
    CONTRADICTION = "contradiction"


class ErrorCode(str, Enum):
    """Enum central — el backend NUNCA usa un string de error fuera de esta lista.

    Mapeo error_code -> status HTTP -> disparador (spec, sección 4):
      PARSE_ERROR            200  entrada no parseable / insegura
      VALIDATION_ERROR       422  payload Pydantic inválido
      TIMEOUT                200  operación (o verificación de pasos) excede su presupuesto
      COMPLEXITY_LIMIT       200  nodos/profundidad/dígitos/exponente/términos excedidos
      SINGULAR_MATRIX        200  inversa de matriz singular
      DIMENSION_MISMATCH     200  matriz no cuadrada/rectangular/incompatible
      DOMAIN_ERROR           200  operación matemáticamente indefinida
      AMBIGUOUS_VARIABLE     200  solve con >1 símbolo libre sin variable especificada
      INVALID_VARIABLE       200  variable de gráfica no coincide con la expresión
      UNSUPPORTED_IN_PHASE_1 200  feature de Fase 2 sin passthrough trivial
      INTERNAL_ERROR         500  excepción no esperada / error de red en el cliente
    """

    PARSE_ERROR = "PARSE_ERROR"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    TIMEOUT = "TIMEOUT"
    COMPLEXITY_LIMIT = "COMPLEXITY_LIMIT"
    SINGULAR_MATRIX = "SINGULAR_MATRIX"
    DIMENSION_MISMATCH = "DIMENSION_MISMATCH"
    DOMAIN_ERROR = "DOMAIN_ERROR"
    AMBIGUOUS_VARIABLE = "AMBIGUOUS_VARIABLE"
    INVALID_VARIABLE = "INVALID_VARIABLE"
    UNSUPPORTED_IN_PHASE_1 = "UNSUPPORTED_IN_PHASE_1"
    INTERNAL_ERROR = "INTERNAL_ERROR"


# error_code -> status HTTP, para uso de exception_handlers.py y de los
# routers al construir la respuesta. Vive aquí porque es parte del contrato
# (una sola fuente de verdad para el mapeo), no una decisión de un módulo
# posterior.
ERROR_CODE_HTTP_STATUS: Dict[ErrorCode, int] = {
    ErrorCode.PARSE_ERROR: 200,
    ErrorCode.VALIDATION_ERROR: 422,
    ErrorCode.TIMEOUT: 200,
    ErrorCode.COMPLEXITY_LIMIT: 200,
    ErrorCode.SINGULAR_MATRIX: 200,
    ErrorCode.DIMENSION_MISMATCH: 200,
    ErrorCode.DOMAIN_ERROR: 200,
    ErrorCode.AMBIGUOUS_VARIABLE: 200,
    ErrorCode.INVALID_VARIABLE: 200,
    ErrorCode.UNSUPPORTED_IN_PHASE_1: 200,
    ErrorCode.INTERNAL_ERROR: 500,
}


class Step(BaseModel):
    index: int
    title: str
    description: str
    rule: Optional[str] = None
    latex_before: str
    latex_after: str


class EquationSolution(BaseModel):
    text: str
    latex: str
    is_complex: bool = False


class Trace(BaseModel):
    type: str
    name: str
    x: List[float]
    y: List[Optional[float]]
    z: Optional[List[List[float]]] = None


class GraphData(BaseModel):
    traces: List[Trace]
    x_range: List[float]
    y_range: Optional[List[float]] = None
    points_truncated: bool = False


class MathResponse(BaseModel):
    success: bool
    operation: OperationType
    request_id: str
    result_type: Optional[ResultType] = None
    input_text: Optional[str] = None
    input_latex: Optional[str] = None
    result_latex: Optional[str] = None
    result_text: Optional[str] = None
    result_approx: Optional[float] = None
    result_data: Optional[Union[List[EquationSolution], List[List[str]]]] = None
    steps: List[Step] = []
    has_detailed_steps: bool
    graph_data: Optional[GraphData] = None
    warnings: List[str] = []
    error_code: Optional[ErrorCode] = None
    error_message: Optional[str] = None
    duration_ms: float
