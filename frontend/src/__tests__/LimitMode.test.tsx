import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LimitMode } from "../components/LimitMode";

vi.mock("../api/client", () => ({
  callApi: vi.fn(),
}));

// Mismo mock que DerivativeMode.test.tsx — MathLive define un custom
// element que jsdom no soporta.
vi.mock("../components/NaturalMathField", () => ({
  NaturalMathField: ({
    latex,
    onLatexChange,
    ariaLabel,
  }: {
    latex: string;
    onLatexChange: (v: string) => void;
    ariaLabel: string;
  }) => <input aria-label={ariaLabel} value={latex} onChange={(e) => onLatexChange(e.target.value)} />,
  latexToBackendSyntax: (latex: string) => latex.trim(),
}));

import { callApi } from "../api/client";

const mockedCallApi = vi.mocked(callApi);

beforeEach(() => {
  mockedCallApi.mockReset();
  mockedCallApi.mockResolvedValue({
    success: true,
    operation: "limit",
    request_id: "id",
    steps: [],
    has_detailed_steps: false,
    warnings: [],
    duration_ms: 1,
  } as never);
});

describe("LimitMode", () => {
  it("arma el payload correcto contra /limit con un punto finito", async () => {
    render(<LimitMode />);
    fireEvent.change(screen.getByLabelText("Expresión"), { target: { value: "(x**2-4)/(x-2)" } });
    fireEvent.change(screen.getByLabelText("Punto"), { target: { value: "2" } });
    fireEvent.submit(screen.getByRole("button", { name: "Calcular límite" }).closest("form")!);

    await waitFor(() => expect(mockedCallApi).toHaveBeenCalled());

    expect(mockedCallApi).toHaveBeenCalledWith("/limit", {
      expression: "(x**2-4)/(x-2)",
      variable: "x",
      point: "2",
      direction: "both",
    });
  });

  it("el botón ∞ pone el punto en 'oo'", async () => {
    render(<LimitMode />);
    fireEvent.change(screen.getByLabelText("Expresión"), { target: { value: "1/x" } });
    fireEvent.click(screen.getByRole("button", { name: "∞" }));
    fireEvent.submit(screen.getByRole("button", { name: "Calcular límite" }).closest("form")!);

    await waitFor(() => expect(mockedCallApi).toHaveBeenCalled());

    expect(mockedCallApi).toHaveBeenCalledWith(
      "/limit",
      expect.objectContaining({ point: "oo" }),
    );
  });

  it("el botón −∞ pone el punto en '-oo'", async () => {
    render(<LimitMode />);
    fireEvent.change(screen.getByLabelText("Expresión"), { target: { value: "1/x" } });
    fireEvent.click(screen.getByRole("button", { name: "−∞" }));
    fireEvent.submit(screen.getByRole("button", { name: "Calcular límite" }).closest("form")!);

    await waitFor(() => expect(mockedCallApi).toHaveBeenCalled());

    expect(mockedCallApi).toHaveBeenCalledWith(
      "/limit",
      expect.objectContaining({ point: "-oo" }),
    );
  });

  it("selector de lado: lateral derecho manda direction: 'right'", async () => {
    render(<LimitMode />);
    fireEvent.change(screen.getByLabelText("Expresión"), { target: { value: "1/x" } });
    fireEvent.change(screen.getByLabelText("Punto"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("Lado"), { target: { value: "right" } });
    fireEvent.submit(screen.getByRole("button", { name: "Calcular límite" }).closest("form")!);

    await waitFor(() => expect(mockedCallApi).toHaveBeenCalled());

    expect(mockedCallApi).toHaveBeenCalledWith(
      "/limit",
      expect.objectContaining({ direction: "right" }),
    );
  });

  it("no llama a la API con una expresión vacía (payload inválido)", () => {
    render(<LimitMode />);
    fireEvent.submit(screen.getByRole("button", { name: "Calcular límite" }).closest("form")!);

    expect(screen.getByRole("alert")).toHaveTextContent("no puede estar vacía");
    expect(mockedCallApi).not.toHaveBeenCalled();
  });
});
