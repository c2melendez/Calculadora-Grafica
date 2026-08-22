import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { MathResponse } from "../api/client";
import { ResultPanel } from "../components/ResultPanel";

const baseResult: MathResponse = {
  success: true,
  operation: "evaluate",
  request_id: "id",
  result_type: "scalar",
  result_text: "3.14159",
  result_latex: null,
  result_approx: 3.14159,
  steps: [],
  has_detailed_steps: false,
  warnings: [],
  duration_ms: 2.1,
};

describe("ResultPanel", () => {
  it("muestra 'Calculando…' mientras isLoading es true", () => {
    render(<ResultPanel result={null} isLoading />);
    expect(screen.getByRole("status")).toHaveTextContent("Calculando");
  });

  it("muestra el mensaje inicial cuando no hay resultado ni carga", () => {
    render(<ResultPanel result={null} isLoading={false} />);
    expect(screen.getByText(/Introduce una expresión/)).toBeInTheDocument();
  });

  it("has_detailed_steps: false y result_latex: null — caso explícito del Módulo 11B", () => {
    render(<ResultPanel result={baseResult} isLoading={false} />);

    // Se muestra "procedimiento resumido", no un error ni un vacío.
    expect(screen.getByText(/Procedimiento resumido/)).toBeInTheDocument();
    // Sin result_latex, cae a texto plano (result_text/result_approx).
    expect(screen.getByText("3.14159")).toBeInTheDocument();
    // "Copiar como LaTeX" debe estar deshabilitado porque result_latex es null.
    expect(screen.getByRole("button", { name: "Copiar como LaTeX" })).toBeDisabled();
    // "Copiar resultado" sigue habilitado (hay result_text/result_approx).
    expect(screen.getByRole("button", { name: "Copiar resultado" })).toBeEnabled();
    // Sin pasos detallados, StepList no debe renderizar nada.
    expect(screen.queryByLabelText("Procedimiento paso a paso")).not.toBeInTheDocument();
  });

  it("muestra los warnings cuando existen", () => {
    render(
      <ResultPanel
        result={{ ...baseResult, warnings: ["Variable inferida automáticamente: 'x'."] }}
        isLoading={false}
      />,
    );
    expect(screen.getByText(/Variable inferida automáticamente/)).toBeInTheDocument();
  });

  it("muestra error_code y error_message cuando success es false", () => {
    render(
      <ResultPanel
        result={{
          success: false,
          operation: "evaluate",
          request_id: "id",
          steps: [],
          has_detailed_steps: false,
          warnings: [],
          error_code: "PARSE_ERROR",
          error_message: "No se pudo interpretar la expresión.",
          duration_ms: 1,
        }}
        isLoading={false}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("PARSE_ERROR");
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo interpretar la expresión.");
  });

  it("renderiza los steps con StepList cuando has_detailed_steps es true", () => {
    render(
      <ResultPanel
        result={{
          ...baseResult,
          has_detailed_steps: true,
          result_latex: "2x",
          steps: [
            {
              index: 0,
              title: "Regla de la potencia",
              description: "d/dx[x^2] = 2x",
              rule: "PowerRule",
              latex_before: "x^2",
              latex_after: "2x",
            },
          ],
        }}
        isLoading={false}
      />,
    );
    expect(screen.getByLabelText("Procedimiento paso a paso")).toBeInTheDocument();
    expect(screen.getByText("Regla de la potencia")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copiar como LaTeX" })).toBeEnabled();
  });
});
