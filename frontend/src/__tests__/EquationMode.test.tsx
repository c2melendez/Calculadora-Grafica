import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EquationMode } from "../components/EquationMode";

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
    operation: "solve",
    request_id: "id",
    steps: [],
    has_detailed_steps: false,
    warnings: [],
    duration_ms: 1,
  } as never);
});

describe("EquationMode", () => {
  it("arma el payload correcto contra /solve sin variable (inferencia automática)", async () => {
    render(<EquationMode />);
    fireEvent.change(screen.getByLabelText("Ecuación", { selector: "input" }), {
      target: { value: "2*x+4=0" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Resolver" }).closest("form")!);

    await waitFor(() => expect(mockedCallApi).toHaveBeenCalled());

    expect(mockedCallApi).toHaveBeenCalledWith("/solve", {
      equation: "2*x+4=0",
      angle_unit: "rad",
    });
  });

  it("arma el payload correcto contra /solve con variable explícita", async () => {
    render(<EquationMode />);
    fireEvent.change(screen.getByLabelText("Ecuación", { selector: "input" }), {
      target: { value: "x+y=0" },
    });
    fireEvent.change(screen.getByLabelText("Variable a despejar (opcional)"), {
      target: { value: "x" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Resolver" }).closest("form")!);

    await waitFor(() => expect(mockedCallApi).toHaveBeenCalled());

    expect(mockedCallApi).toHaveBeenCalledWith("/solve", {
      equation: "x+y=0",
      angle_unit: "rad",
      variable: "x",
    });
  });

  it("no llama a la API con una ecuación vacía (payload inválido)", () => {
    render(<EquationMode />);
    fireEvent.submit(screen.getByRole("button", { name: "Resolver" }).closest("form")!);

    expect(screen.getByRole("alert")).toHaveTextContent("no puede estar vacía");
    expect(mockedCallApi).not.toHaveBeenCalled();
  });

  it("detecta automáticamente una desigualdad y rutea a /inequality", async () => {
    render(<EquationMode />);
    fireEvent.change(screen.getByLabelText("Ecuación", { selector: "input" }), {
      target: { value: "x+1>0" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Resolver" }).closest("form")!);

    await waitFor(() => expect(mockedCallApi).toHaveBeenCalled());

    expect(mockedCallApi).toHaveBeenCalledWith("/inequality", {
      inequality: "x+1>0",
    });
  });

  it("desigualdad con <= incluye la variable explícita cuando se indica", async () => {
    render(<EquationMode />);
    fireEvent.change(screen.getByLabelText("Ecuación", { selector: "input" }), {
      target: { value: "x**2-4<=0" },
    });
    fireEvent.change(screen.getByLabelText("Variable a despejar (opcional)"), {
      target: { value: "x" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Resolver" }).closest("form")!);

    await waitFor(() => expect(mockedCallApi).toHaveBeenCalled());

    expect(mockedCallApi).toHaveBeenCalledWith("/inequality", {
      inequality: "x**2-4<=0",
      variable: "x",
    });
  });
});
