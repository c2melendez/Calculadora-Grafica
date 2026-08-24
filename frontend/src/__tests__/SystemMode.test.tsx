import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SystemMode } from "../components/SystemMode";

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
    operation: "solve_system",
    request_id: "id",
    result_type: "equation_solutions",
    result_data: [{ text: "x=3, y=2", latex: "x = 3,\\ y = 2", is_complex: false }],
    steps: [],
    has_detailed_steps: false,
    warnings: [],
    duration_ms: 1,
  } as never);
});

describe("SystemMode", () => {
  it("arma el payload correcto contra /solve/system con 2 ecuaciones y 2 variables", async () => {
    render(<SystemMode />);
    fireEvent.change(screen.getByLabelText("Ecuación 1"), { target: { value: "x+y=5" } });
    fireEvent.change(screen.getByLabelText("Ecuación 2"), { target: { value: "x-y=1" } });
    fireEvent.submit(screen.getByRole("button", { name: "Resolver sistema" }).closest("form")!);

    await waitFor(() => expect(mockedCallApi).toHaveBeenCalled());

    expect(mockedCallApi).toHaveBeenCalledWith("/solve/system", {
      equations: ["x+y=5", "x-y=1"],
      variables: ["x", "y"],
    });
  });

  it("permite añadir una tercera ecuación y variable (sistema 3x3)", async () => {
    render(<SystemMode />);
    fireEvent.click(screen.getByRole("button", { name: "+ Añadir ecuación" }));
    fireEvent.change(screen.getByLabelText("Ecuación 1"), { target: { value: "x+y+z=6" } });
    fireEvent.change(screen.getByLabelText("Ecuación 2"), { target: { value: "2*y+5*z=-4" } });
    fireEvent.change(screen.getByLabelText("Ecuación 3"), { target: { value: "2*x+5*y-z=27" } });
    fireEvent.change(screen.getByLabelText(/^Variables/), { target: { value: "x, y, z" } });
    fireEvent.submit(screen.getByRole("button", { name: "Resolver sistema" }).closest("form")!);

    await waitFor(() => expect(mockedCallApi).toHaveBeenCalled());

    expect(mockedCallApi).toHaveBeenCalledWith("/solve/system", {
      equations: ["x+y+z=6", "2*y+5*z=-4", "2*x+5*y-z=27"],
      variables: ["x", "y", "z"],
    });
  });

  it("no llama a la API si el número de variables no coincide con el de ecuaciones", () => {
    render(<SystemMode />);
    fireEvent.change(screen.getByLabelText("Ecuación 1"), { target: { value: "x+y=5" } });
    fireEvent.change(screen.getByLabelText("Ecuación 2"), { target: { value: "x-y=1" } });
    fireEvent.change(screen.getByLabelText(/^Variables/), { target: { value: "x" } });
    fireEvent.submit(screen.getByRole("button", { name: "Resolver sistema" }).closest("form")!);

    expect(screen.getByRole("alert")).toHaveTextContent("debe coincidir");
    expect(mockedCallApi).not.toHaveBeenCalled();
  });

  it("no llama a la API si una ecuación no tiene signo =", () => {
    render(<SystemMode />);
    fireEvent.change(screen.getByLabelText("Ecuación 1"), { target: { value: "x+y" } });
    fireEvent.change(screen.getByLabelText("Ecuación 2"), { target: { value: "x-y=1" } });
    fireEvent.submit(screen.getByRole("button", { name: "Resolver sistema" }).closest("form")!);

    expect(screen.getByRole("alert")).toHaveTextContent("signo =");
    expect(mockedCallApi).not.toHaveBeenCalled();
  });
});
