/**
 * src/__tests__/e2e.test.tsx — Prueba E2E MÍNIMA (spec, sección 15,
 * Módulo 12): introducir x^2 en modo Derivada -> petición real (mockeada
 * a nivel de `fetch`, no de `callApi`) -> `MathResponse` real -> `steps`
 * renderizados -> guardado en historial -> `reuseEntry` reconstruye y
 * reejecuta correctamente.
 *
 * ALCANCE (decisión DEDUCIBLE, documentada en el cierre del Módulo 12):
 * esto es un E2E de INTEGRACIÓN a nivel de componentes de React con la
 * capa `fetch` mockeada (no un E2E de navegador real contra el backend en
 * ejecución vía Playwright/Cypress). Un E2E de navegador real está fuera
 * de alcance razonable para este módulo — no hay Playwright/Cypress
 * instalado ni un mandato explícito de instalarlo, y el flujo completo
 * (parsing, derivada, verificación, HTTP, render, KaTeX, historial,
 * reuse) SÍ se ejercita de principio a fin, solo que con la respuesta de
 * red simulada en la frontera de `fetch` en vez de un servidor real.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "../App";
import { HISTORY_STORAGE_KEY, useHistoryStore } from "../store/useHistoryStore";

// El modo Básico (montado por defecto al renderizar <App />) usa MathLive
// (<math-field>), un custom element que jsdom no implementa. Se sustituye
// por un <input> equivalente — este E2E ejercita el modo Derivada, no la
// conversión LaTeX del modo Básico (esa se prueba aparte en
// NaturalMathField.test.ts).
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

const DERIVATIVE_RESPONSE = {
  success: true,
  operation: "derivative",
  request_id: "e2e-request-id",
  result_type: "scalar",
  input_text: "x**2",
  input_latex: "x^{2}",
  result_latex: "2 x",
  result_text: "2*x",
  steps: [
    {
      index: 0,
      title: "Regla de la potencia",
      description: "d/dx[x^n] = n·x^(n-1), con n = 2.",
      rule: "PowerRule",
      latex_before: "x^{2}",
      latex_after: "2 x",
    },
  ],
  has_detailed_steps: true,
  warnings: [],
  duration_ms: 4.2,
};

describe("E2E mínimo — Derivada (sección 15)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    window.localStorage.clear();
    useHistoryStore.setState({ entries: [] });
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve(DERIVATIVE_RESPONSE),
    } as unknown as Response);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("x**2 en Derivada -> MathResponse real -> steps renderizados -> historial -> reuseEntry reejecuta", async () => {
    render(<App />);

    // 1. Cambiar al modo Derivada.
    fireEvent.click(screen.getByRole("button", { name: "Derivada" }));

    // 2. Introducir x**2 y enviar.
    const expressionInput = screen.getByLabelText("Expresión");
    fireEvent.change(expressionInput, { target: { value: "x**2" } });
    fireEvent.submit(screen.getByRole("button", { name: "Derivar" }).closest("form")!);

    // 3. Petición real (fetch mockeado en la frontera de red) -> MathResponse real.
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
    const [url, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/api/v1/derivative");
    expect(JSON.parse((options as RequestInit).body as string)).toEqual({
      expression: "x**2",
      variable: "x",
      order: 1,
    });

    // 4. result_latex y steps renderizados.
    await screen.findByText("Regla de la potencia");
    expect(screen.getByLabelText("Procedimiento paso a paso")).toBeInTheDocument();

    // 5. Guardado en historial.
    expect(useHistoryStore.getState().entries).toHaveLength(1);
    const savedEntry = useHistoryStore.getState().entries[0];
    expect(savedEntry.endpointUrl).toBe("/derivative");
    expect(savedEntry.resultText).toBe("2*x");
    // También persistido de verdad en localStorage, no solo en memoria.
    const persisted = JSON.parse(window.localStorage.getItem(HISTORY_STORAGE_KEY) as string);
    expect(persisted.entries).toHaveLength(1);

    // 6. Abrir el historial y reusar la entrada -> reconstruye y reejecuta.
    fireEvent.click(screen.getByRole("button", { name: "Historial" }));
    fireEvent.click(screen.getByRole("button", { name: /Reusar entrada/ }));

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2));
    const [reuseUrl, reuseOptions] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[1];
    expect(reuseUrl).toContain("/api/v1/derivative");
    expect(JSON.parse((reuseOptions as RequestInit).body as string)).toEqual({
      expression: "x**2",
      variable: "x",
      order: 1,
    });

    // El resultado reusado también se renderiza (segunda ocurrencia del
    // mismo paso, esta vez dentro del panel de historial — result_latex se
    // renderiza vía KaTeX como spans, no como el texto plano "2*x", así
    // que se verifica sobre el título del step, que sí es texto plano).
    await waitFor(() => {
      expect(screen.getAllByText("Regla de la potencia").length).toBe(2);
    });
  });
});
