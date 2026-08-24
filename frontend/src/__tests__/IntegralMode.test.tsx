import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IntegralMode } from "../components/IntegralMode";

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
    operation: "integral",
    request_id: "id",
    steps: [],
    has_detailed_steps: false,
    warnings: [],
    duration_ms: 1,
  } as never);
});

describe("IntegralMode", () => {
  it("arma el payload correcto contra /integral (sin límites)", async () => {
    render(<IntegralMode />);
    fireEvent.change(screen.getByLabelText("Expresión"), { target: { value: "sin(x)" } });
    fireEvent.submit(screen.getByRole("button", { name: "Integrar" }).closest("form")!);

    await waitFor(() => expect(mockedCallApi).toHaveBeenCalled());

    expect(mockedCallApi).toHaveBeenCalledWith("/integral", {
      expression: "sin(x)",
      variable: "x",
    });
  });

  it("arma el payload correcto contra /integral (con límites)", async () => {
    render(<IntegralMode />);
    fireEvent.change(screen.getByLabelText("Expresión"), { target: { value: "x**2" } });
    fireEvent.change(screen.getByLabelText("Límite inferior (opcional; \"oo\"/\"-oo\" para impropia)"), {
      target: { value: "0" },
    });
    fireEvent.change(screen.getByLabelText("Límite superior (opcional)"), {
      target: { value: "2" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Integrar" }).closest("form")!);

    await waitFor(() => expect(mockedCallApi).toHaveBeenCalled());

    expect(mockedCallApi).toHaveBeenCalledWith("/integral", {
      expression: "x**2",
      variable: "x",
      lower_bound: "0",
      upper_bound: "2",
    });
  });

  it("no llama a la API si solo se especifica un límite (payload inválido)", () => {
    render(<IntegralMode />);
    fireEvent.change(screen.getByLabelText("Expresión"), { target: { value: "x**2" } });
    fireEvent.change(screen.getByLabelText("Límite inferior (opcional; \"oo\"/\"-oo\" para impropia)"), {
      target: { value: "0" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Integrar" }).closest("form")!);

    expect(screen.getByRole("alert")).toHaveTextContent("juntos o ninguno");
    expect(mockedCallApi).not.toHaveBeenCalled();
  });
  it("rutea a /integral/improper cuando el límite superior es oo", async () => {
    render(<IntegralMode />);
    fireEvent.change(screen.getByLabelText("Expresión"), { target: { value: "exp(-x)" } });
    fireEvent.change(
      screen.getByLabelText('Límite inferior (opcional; "oo"/"-oo" para impropia)'),
      { target: { value: "0" } },
    );
    fireEvent.change(screen.getByLabelText("Límite superior (opcional)"), {
      target: { value: "oo" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Integrar" }).closest("form")!);

    await waitFor(() => expect(mockedCallApi).toHaveBeenCalled());

    expect(mockedCallApi).toHaveBeenCalledWith("/integral/improper", {
      expression: "exp(-x)",
      variable: "x",
      lower_bound: "0",
      upper_bound: "oo",
    });
  });

  it("rutea a /integral/improper cuando el límite inferior es -oo", async () => {
    render(<IntegralMode />);
    fireEvent.change(screen.getByLabelText("Expresión"), { target: { value: "exp(x)" } });
    fireEvent.change(
      screen.getByLabelText('Límite inferior (opcional; "oo"/"-oo" para impropia)'),
      { target: { value: "-oo" } },
    );
    fireEvent.change(screen.getByLabelText("Límite superior (opcional)"), {
      target: { value: "0" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Integrar" }).closest("form")!);

    await waitFor(() => expect(mockedCallApi).toHaveBeenCalled());

    expect(mockedCallApi).toHaveBeenCalledWith("/integral/improper", {
      expression: "exp(x)",
      variable: "x",
      lower_bound: "-oo",
      upper_bound: "0",
    });
  });
});
