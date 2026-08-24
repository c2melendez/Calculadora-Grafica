import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GraphMode } from "../components/GraphMode";

vi.mock("../api/client", () => ({
  callApi: vi.fn(),
}));

// GraphViewer hace un import dinámico real de Plotly (Módulo 12); se
// mockea igual que en GraphViewer.test.tsx para poder probar el caso con
// graph_data (que SÍ monta <GraphViewer>) sin depender de Plotly real.
vi.mock("plotly.js-dist-min", () => ({
  default: { newPlot: vi.fn().mockResolvedValue(undefined), toImage: vi.fn(), purge: vi.fn() },
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
    operation: "graph_2d",
    request_id: "id",
    steps: [],
    has_detailed_steps: false,
    warnings: [],
    duration_ms: 1,
  } as never);
});

describe("GraphMode", () => {
  it("arma el payload correcto contra /graph/2d con una sola expresión", async () => {
    render(<GraphMode />);
    fireEvent.change(screen.getByLabelText("Expresión 1"), { target: { value: "sin(x)" } });
    fireEvent.submit(screen.getByRole("button", { name: "Graficar" }).closest("form")!);

    await waitFor(() => expect(mockedCallApi).toHaveBeenCalled());

    expect(mockedCallApi).toHaveBeenCalledWith("/graph/2d", {
      expressions: ["sin(x)"],
      variable: "x",
      angle_unit: "rad",
    });
  });

  it("arma el payload correcto con dos expresiones y dominio explícito", async () => {
    render(<GraphMode />);
    fireEvent.change(screen.getByLabelText("Expresión 1"), { target: { value: "sin(x)" } });
    fireEvent.click(screen.getByRole("button", { name: "+ Añadir expresión" }));
    fireEvent.change(screen.getByLabelText("Expresión 2"), { target: { value: "cos(x)" } });
    fireEvent.change(screen.getByLabelText("x mínimo (opcional)"), { target: { value: "-5" } });
    fireEvent.change(screen.getByLabelText("x máximo (opcional)"), { target: { value: "5" } });
    fireEvent.submit(screen.getByRole("button", { name: "Graficar" }).closest("form")!);

    await waitFor(() => expect(mockedCallApi).toHaveBeenCalled());

    expect(mockedCallApi).toHaveBeenCalledWith("/graph/2d", {
      expressions: ["sin(x)", "cos(x)"],
      variable: "x",
      angle_unit: "rad",
      x_min: -5,
      x_max: 5,
    });
  });

  it("no llama a la API si solo se especifica x_min (payload inválido)", () => {
    render(<GraphMode />);
    fireEvent.change(screen.getByLabelText("Expresión 1"), { target: { value: "x" } });
    fireEvent.change(screen.getByLabelText("x mínimo (opcional)"), { target: { value: "-5" } });
    fireEvent.submit(screen.getByRole("button", { name: "Graficar" }).closest("form")!);

    expect(screen.getByRole("alert")).toHaveTextContent("juntos o ninguno");
    expect(mockedCallApi).not.toHaveBeenCalled();
  });

  it("muestra el análisis (dominio/rango/interceptos/extremos) cuando graph_data lo trae", async () => {
    mockedCallApi.mockResolvedValue({
      success: true,
      operation: "graph_2d",
      request_id: "id",
      steps: [],
      has_detailed_steps: false,
      warnings: [],
      duration_ms: 1,
      graph_data: {
        traces: [{ type: "line", name: "x**2-4", x: [0, 1], y: [-4, -3] }],
        x_range: [-10, 10],
        points_truncated: false,
        analysis: [
          {
            domain_text: "Reals",
            range_text: "Interval(-4, oo)",
            y_intercept: "-4",
            x_intercepts: ["-2", "2"],
            local_maxima: [],
            local_minima: ["0"],
            inflection_points: [],
          },
        ],
      },
    } as never);

    render(<GraphMode />);
    fireEvent.change(screen.getByLabelText("Expresión 1"), { target: { value: "x**2-4" } });
    fireEvent.submit(screen.getByRole("button", { name: "Graficar" }).closest("form")!);

    await waitFor(() => expect(screen.getByText("Reals")).toBeInTheDocument());
    expect(screen.getByText("Interval(-4, oo)")).toBeInTheDocument();
    expect(screen.getByText("-2, 2")).toBeInTheDocument();
    expect(
      screen.getByText((text, element) => element?.tagName.toLowerCase() === "dd" && text === "0"),
    ).toBeInTheDocument();
  });

  it("pestaña 3D: arma el payload correcto contra /graph/3d", async () => {
    render(<GraphMode />);
    fireEvent.click(screen.getByRole("tab", { name: "3D" }));
    fireEvent.change(screen.getByLabelText("Expresión"), { target: { value: "x**2+y**2" } });
    fireEvent.submit(
      screen.getByRole("button", { name: "Graficar superficie" }).closest("form")!,
    );

    await waitFor(() => expect(mockedCallApi).toHaveBeenCalled());

    expect(mockedCallApi).toHaveBeenCalledWith("/graph/3d", {
      expression: "x**2+y**2",
      variables: ["x", "y"],
      x_range: [-10, 10],
      y_range: [-10, 10],
    });
  });

  it("pestaña Paramétrica: arma el payload correcto contra /graph/parametric", async () => {
    render(<GraphMode />);
    fireEvent.click(screen.getByRole("tab", { name: "Paramétrica" }));
    fireEvent.change(screen.getByLabelText("x(t)"), { target: { value: "cos(t)" } });
    fireEvent.change(screen.getByLabelText("y(t)"), { target: { value: "sin(t)" } });
    fireEvent.submit(screen.getByRole("button", { name: "Graficar curva" }).closest("form")!);

    await waitFor(() => expect(mockedCallApi).toHaveBeenCalled());

    expect(mockedCallApi).toHaveBeenCalledWith("/graph/parametric", {
      x_expression: "cos(t)",
      y_expression: "sin(t)",
      parameter: "t",
      t_min: 0,
      t_max: 6.283185307179586,
    });
  });

  it("pestaña Paramétrica: no llama a la API si falta una componente", () => {
    render(<GraphMode />);
    fireEvent.click(screen.getByRole("tab", { name: "Paramétrica" }));
    fireEvent.change(screen.getByLabelText("x(t)"), { target: { value: "cos(t)" } });
    fireEvent.submit(screen.getByRole("button", { name: "Graficar curva" }).closest("form")!);

    expect(screen.getByRole("alert")).toHaveTextContent("Ambas componentes");
    expect(mockedCallApi).not.toHaveBeenCalled();
  });
});
