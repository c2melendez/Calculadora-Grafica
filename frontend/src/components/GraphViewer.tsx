/**
 * src/components/GraphViewer.tsx — visor de gráficas 2D (spec, sección
 * 11): import DINÁMICO de Plotly (nunca en el bundle principal — solo se
 * carga cuando este componente realmente se monta, vía `React.lazy` en
 * `GraphMode.tsx`), botón "Descargar PNG" con `Plotly.toImage()`.
 */

import { useEffect, useRef, useState } from "react";

import type { components } from "../types/api";

type GraphData = components["schemas"]["GraphData"];

// Tipo mínimo del módulo Plotly que realmente usamos — evita depender de
// toda la superficie de @types/plotly.js en la firma pública de este
// archivo, pero sigue tipado (no `any`).
interface PlotlyModule {
  newPlot: (
    div: HTMLElement,
    data: unknown[],
    layout: Record<string, unknown>,
    config?: Record<string, unknown>,
  ) => Promise<unknown>;
  toImage: (
    div: HTMLElement,
    opts: { format: string; width: number; height: number },
  ) => Promise<string>;
  purge: (div: HTMLElement) => void;
}

function traceToPlotly(trace: GraphData["traces"][number]) {
  if (trace.type === "surface") {
    return {
      x: trace.x,
      y: trace.y,
      z: trace.z,
      type: "surface" as const,
      name: trace.name,
      colorscale: "Viridis" as const,
      showscale: false,
    };
  }
  return {
    x: trace.x,
    y: trace.y,
    type: "scatter" as const,
    mode: "lines" as const,
    name: trace.name,
    connectgaps: false, // los `null` (discontinuidades, sección 10) cortan la línea
  };
}

function isSurface(data: GraphData): boolean {
  return data.traces.some((trace) => trace.type === "surface");
}

interface GraphViewerProps {
  data: GraphData;
}

export default function GraphViewer({ data }: GraphViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const plotlyRef = useRef<PlotlyModule | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;
    const safeContainer: HTMLDivElement = container;

    let cancelled = false;

    async function render(): Promise<void> {
      try {
        const plotlyModule = (await import("plotly.js-dist-min")) as unknown as {
          default: PlotlyModule;
        };
        const Plotly = plotlyModule.default;
        if (cancelled) return;
        plotlyRef.current = Plotly;

        await Plotly.newPlot(
          safeContainer,
          data.traces.map(traceToPlotly),
          isSurface(data)
            ? {
                scene: {
                  xaxis: { title: "x" },
                  yaxis: { title: "y" },
                  zaxis: { title: "z" },
                },
                paper_bgcolor: "transparent",
                font: { color: "#1C1F26" },
                margin: { t: 20, r: 20, b: 20, l: 20 },
              }
            : {
                xaxis: { range: data.x_range, title: "x" },
                yaxis: data.y_range ? { range: data.y_range } : {},
                paper_bgcolor: "transparent",
                plot_bgcolor: "transparent",
                font: { color: "#1C1F26" },
                margin: { t: 20, r: 20, b: 40, l: 50 },
              },
          { responsive: true, displaylogo: false },
        );
      } catch {
        if (!cancelled) {
          setLoadError("No se pudo cargar el visor de gráficas.");
        }
      }
    }

    void render();

    return () => {
      cancelled = true;
      if (plotlyRef.current) {
        plotlyRef.current.purge(safeContainer);
      }
    };
  }, [data]);

  async function handleDownloadPng(): Promise<void> {
    if (!containerRef.current || !plotlyRef.current) return;
    try {
      const url = await plotlyRef.current.toImage(containerRef.current, {
        format: "png",
        width: 900,
        height: 600,
      });
      const link = document.createElement("a");
      link.href = url;
      link.download = "grafica.png";
      link.click();
    } catch {
      setDownloadError("No se pudo generar la imagen PNG.");
    }
  }

  if (loadError) {
    return (
      <p role="alert" className="text-sm text-red-600">
        {loadError}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {data.points_truncated && (
        <p className="text-xs text-amber-600">
          ⚠ Se redujo la densidad de muestreo respecto a lo solicitado.
        </p>
      )}
      <div
        ref={containerRef}
        role="img"
        aria-label="Gráfica de las expresiones ingresadas"
        className="h-96 w-full rounded border border-paper-line"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleDownloadPng}
          aria-label="Descargar gráfica como PNG"
          className="rounded border border-paper-line px-3 py-1 text-xs text-muted hover:bg-paper-line/40"
        >
          Descargar PNG
        </button>
        {downloadError && (
          <span role="alert" className="text-xs text-red-600">
            {downloadError}
          </span>
        )}
      </div>
    </div>
  );
}
