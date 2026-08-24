import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DerivativeMode } from "../components/DerivativeMode";

vi.mock("../api/client", () => ({
  callApi: vi.fn(),
}));

// MathLive define un custom element (<math-field>) que jsdom no soporta.
// La conversión LaTeX->ASCII real se prueba aparte, sin mocks, en
// NaturalMathField.test.ts.
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
    <input aria-label={ariaLabel} value={latex} onChange={(e) => onLatexChange(e.target.value)} />
  ),
  latexToBackendSyntax: (latex: string) => latex.trim(),
}));

import { callApi } from "../api/client";

const mockedCallApi = vi.mocked(callApi);

beforeEach(() => {
  mockedCallApi.mockReset();
  mockedCallApi.mockResolvedValue({
    success: true,
    operation: "derivative",
    request_id: "id",
    steps: [],
    has_detailed_steps: false,
    warnings: [],
    duration_ms: 1,
  } as never);
});

describe("DerivativeMode", () => {
  it("arma el payload correcto contra /derivative", async () => {
    render(<DerivativeMode />);
    fireEvent.change(screen.getByLabelText("Expresión"), { target: { value: "x**2" } });
    fireEvent.change(screen.getByLabelText("Orden"), { target: { value: "2" } });
    fireEvent.submit(screen.getByRole("button", { name: "Derivar" }).closest("form")!);

    await waitFor(() => expect(mockedCallApi).toHaveBeenCalled());

    expect(mockedCallApi).toHaveBeenCalledWith("/derivative", {
      expression: "x**2",
      variable: "x",
      order: 2,
    });
  });

  it("no llama a la API con orden fuera de rango (payload inválido)", () => {
    render(<DerivativeMode />);
    fireEvent.change(screen.getByLabelText("Expresión"), { target: { value: "x**2" } });
    fireEvent.change(screen.getByLabelText("Orden"), { target: { value: "9" } });
    fireEvent.submit(screen.getByRole("button", { name: "Derivar" }).closest("form")!);

    expect(screen.getByRole("alert")).toHaveTextContent("entre 1 y 5");
    expect(mockedCallApi).not.toHaveBeenCalled();
  });

  it("modo implícito: arma el payload correcto contra /derivative/implicit", async () => {
    render(<DerivativeMode />);
    fireEvent.click(screen.getByLabelText("Derivada implícita (ecuación con dos variables)"));
    fireEvent.change(screen.getByLabelText("Ecuación"), { target: { value: "x**2+y**2=1" } });
    fireEvent.submit(screen.getByRole("button", { name: "Derivar" }).closest("form")!);

    await waitFor(() => expect(mockedCallApi).toHaveBeenCalled());

    expect(mockedCallApi).toHaveBeenCalledWith("/derivative/implicit", {
      equation: "x**2+y**2=1",
      dependent_variable: "y",
      independent_variable: "x",
    });
  });

  it("modo implícito: rechaza una expresión sin signo = antes de llamar a la API", () => {
    render(<DerivativeMode />);
    fireEvent.click(screen.getByLabelText("Derivada implícita (ecuación con dos variables)"));
    fireEvent.change(screen.getByLabelText("Ecuación"), { target: { value: "x**2+y**2" } });
    fireEvent.submit(screen.getByRole("button", { name: "Derivar" }).closest("form")!);

    expect(screen.getByRole("alert")).toHaveTextContent("signo =");
    expect(mockedCallApi).not.toHaveBeenCalled();
  });
});
