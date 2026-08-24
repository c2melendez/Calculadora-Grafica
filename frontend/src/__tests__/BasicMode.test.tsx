import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BasicMode } from "../components/BasicMode";

vi.mock("../api/client", () => ({
  callApi: vi.fn(),
}));

// MathLive define un custom element (<math-field>) que jsdom no soporta
// (no hay verdadero renderizado de fórmulas en un entorno de pruebas sin
// navegador). Se sustituye por un <input> accesible equivalente — la
// conversión LaTeX->ASCII real (`latexToBackendSyntax`) SÍ se prueba por
// separado en NaturalMathField.test.ts con casos concretos.
vi.mock("../components/NaturalMathField", () => ({
  NaturalMathField: ({
    latex,
    onLatexChange,
    ariaLabel,
  }: {
    latex: string;
    onLatexChange: (v: string) => void;
    ariaLabel: string;
  }) => (
    <input
      aria-label={ariaLabel}
      value={latex}
      onChange={(e) => onLatexChange(e.target.value)}
    />
  ),
  latexToBackendSyntax: (latex: string) => latex.trim(),
}));

import { callApi } from "../api/client";

const mockedCallApi = vi.mocked(callApi);

beforeEach(() => {
  mockedCallApi.mockReset();
  mockedCallApi.mockResolvedValue({
    success: true,
    operation: "evaluate",
    request_id: "id",
    steps: [],
    has_detailed_steps: false,
    warnings: [],
    duration_ms: 1,
  } as never);
});

describe("BasicMode", () => {
  it("arma el payload correcto contra /evaluate", async () => {
    render(<BasicMode />);
    fireEvent.change(screen.getByLabelText("Expresión"), { target: { value: "2+2" } });
    fireEvent.submit(screen.getByRole("button", { name: "Evaluar" }).closest("form")!);

    await waitFor(() => expect(mockedCallApi).toHaveBeenCalled());

    expect(mockedCallApi).toHaveBeenCalledWith("/evaluate", {
      expression: "2+2",
      angle_unit: "rad",
    });
  });

  it("incluye substitutions cuando el usuario añade una fila", async () => {
    render(<BasicMode />);
    fireEvent.change(screen.getByLabelText("Expresión"), { target: { value: "x+1" } });
    fireEvent.click(screen.getByRole("button", { name: "+ Añadir sustitución" }));
    fireEvent.change(screen.getByLabelText("Nombre de la variable 1"), {
      target: { value: "x" },
    });
    fireEvent.change(screen.getByLabelText("Valor de la variable 1"), {
      target: { value: "3" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Evaluar" }).closest("form")!);

    await waitFor(() => expect(mockedCallApi).toHaveBeenCalled());

    expect(mockedCallApi).toHaveBeenCalledWith("/evaluate", {
      expression: "x+1",
      angle_unit: "rad",
      substitutions: { x: "3" },
    });
  });

  it("no llama a la API con una expresión vacía (payload inválido)", () => {
    render(<BasicMode />);
    fireEvent.submit(screen.getByRole("button", { name: "Evaluar" }).closest("form")!);

    expect(screen.getByRole("alert")).toHaveTextContent("no puede estar vacía");
    expect(mockedCallApi).not.toHaveBeenCalled();
  });
});
