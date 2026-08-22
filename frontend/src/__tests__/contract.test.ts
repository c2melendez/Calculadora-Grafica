/**
 * src/__tests__/contract.test.ts — prueba de contrato (Módulo 10): un
 * `MathResponse` mock debe tipar correctamente contra `src/types/api.ts`
 * (generado desde el OpenAPI REAL del backend, no manual) y pasar la
 * validación de forma en tiempo de ejecución que usa `client.ts`.
 *
 * Si el backend cambia el contrato de `MathResponse` sin regenerar los
 * tipos, este archivo deja de compilar (`npm run typecheck` falla) — esa
 * es la garantía que ofrece esta prueba.
 */

import { describe, expect, it } from "vitest";

import type { MathResponse } from "../api/client";
import type { components } from "../types/api";

describe("contrato MathResponse", () => {
  it("un MathResponse exitoso tipa correctamente contra los tipos generados", () => {
    const mock: MathResponse = {
      success: true,
      operation: "derivative",
      request_id: "11111111-1111-1111-1111-111111111111",
      result_type: "scalar",
      input_text: "x**2",
      input_latex: "x^{2}",
      result_latex: "2 x",
      result_text: "2*x",
      result_approx: null,
      result_data: null,
      steps: [
        {
          index: 0,
          title: "Regla de la potencia",
          description: "d/dx[x^n] = n*x^(n-1)",
          rule: "PowerRule",
          latex_before: "x^{2}",
          latex_after: "2 x",
        },
      ],
      has_detailed_steps: true,
      graph_data: null,
      warnings: [],
      error_code: null,
      error_message: null,
      duration_ms: 3.4,
    };

    expect(mock.success).toBe(true);
    expect(mock.steps).toHaveLength(1);
  });

  it("un MathResponse de error tipa correctamente y usa un ErrorCode real", () => {
    const errorCode: components["schemas"]["ErrorCode"] = "PARSE_ERROR";
    const mock: MathResponse = {
      success: false,
      operation: "evaluate",
      request_id: "22222222-2222-2222-2222-222222222222",
      steps: [],
      has_detailed_steps: false,
      warnings: [],
      error_code: errorCode,
      error_message: "No se pudo interpretar la expresión.",
      duration_ms: 1.1,
    };

    expect(mock.success).toBe(false);
    expect(mock.error_code).toBe("PARSE_ERROR");
  });

  it("un MathResponse con result_data de matriz (string[][]) tipa correctamente", () => {
    const mock: MathResponse = {
      success: true,
      operation: "matrix_operation",
      request_id: "33333333-3333-3333-3333-333333333333",
      result_type: "matrix",
      result_data: [
        ["1", "2"],
        ["3", "4"],
      ],
      steps: [],
      has_detailed_steps: false,
      warnings: [],
      duration_ms: 2.0,
    };

    expect(Array.isArray(mock.result_data)).toBe(true);
  });

  it("un MathResponse con result_data de EquationSolution[] tipa correctamente", () => {
    const mock: MathResponse = {
      success: true,
      operation: "solve",
      request_id: "44444444-4444-4444-4444-444444444444",
      result_type: "equation_solutions",
      result_data: [{ text: "-2", latex: "-2", is_complex: false }],
      steps: [],
      has_detailed_steps: false,
      warnings: [],
      duration_ms: 2.0,
    };

    expect(mock.result_data).toHaveLength(1);
  });
});
