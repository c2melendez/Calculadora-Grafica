import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { components } from "../types/api";

const newPlot = vi.fn().mockResolvedValue(undefined);
const toImage = vi.fn().mockResolvedValue("data:image/png;base64,fake");
const purge = vi.fn();

vi.mock("plotly.js-dist-min", () => ({
  default: { newPlot, toImage, purge },
}));

// Import DESPUÉS del mock — GraphViewer hace el import dinámico en tiempo
// de ejecución (Módulo 12: "import dinámico real de Plotly").
const GraphViewer = (await import("../components/GraphViewer")).default;

type GraphData = components["schemas"]["GraphData"];

const sampleData: GraphData = {
  traces: [{ type: "line", name: "sin(x)", x: [0, 1, 2], y: [0, 0.84, 0.91] }],
  x_range: [0, 2],
  y_range: [0, 1],
  points_truncated: false,
};

beforeEach(() => {
  newPlot.mockClear();
  toImage.mockClear();
  purge.mockClear();
});

describe("GraphViewer", () => {
  it("llama a Plotly.newPlot con las trazas y el rango correctos (import dinámico)", async () => {
    render(<GraphViewer data={sampleData} />);

    await waitFor(() => expect(newPlot).toHaveBeenCalledTimes(1));

    const [, plotlyTraces, layout] = newPlot.mock.calls[0];
    expect(plotlyTraces).toEqual([
      expect.objectContaining({ x: [0, 1, 2], y: [0, 0.84, 0.91], name: "sin(x)" }),
    ]);
    expect(layout).toEqual(
      expect.objectContaining({ xaxis: expect.objectContaining({ range: [0, 2] }) }),
    );
  });

  it("muestra la advertencia de muestreo reducido cuando points_truncated es true", async () => {
    render(<GraphViewer data={{ ...sampleData, points_truncated: true }} />);
    await waitFor(() => expect(newPlot).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/densidad de muestreo/)).toBeInTheDocument();
  });

  it("el botón 'Descargar PNG' llama a Plotly.toImage", async () => {
    render(<GraphViewer data={sampleData} />);
    await waitFor(() => expect(newPlot).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Descargar gráfica como PNG" }));

    await waitFor(() => expect(toImage).toHaveBeenCalledTimes(1));
    expect(toImage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ format: "png" }),
    );
  });

  it("una superficie 3D usa layout con 'scene' (no xaxis/yaxis planos)", async () => {
    const surfaceData: GraphData = {
      traces: [
        {
          type: "surface",
          name: "x**2+y**2",
          x: [-1, 0, 1],
          y: [-1, 0, 1],
          z: [
            [2, 1, 2],
            [1, 0, 1],
            [2, 1, 2],
          ],
        },
      ],
      x_range: [-1, 1],
      y_range: [-1, 1],
      points_truncated: false,
    };

    render(<GraphViewer data={surfaceData} />);
    await waitFor(() => expect(newPlot).toHaveBeenCalledTimes(1));

    const [, plotlyTraces, layout] = newPlot.mock.calls[0];
    expect(plotlyTraces).toEqual([
      expect.objectContaining({ type: "surface", z: surfaceData.traces[0].z }),
    ]);
    expect(layout).toHaveProperty("scene");
    expect(layout).not.toHaveProperty("xaxis");
  });
});
