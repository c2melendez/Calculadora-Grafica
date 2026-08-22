/**
 * src/components/GraphMode.tsx — modo Gráficas (spec, sección 11):
 * formulario (hasta 5 expresiones, dominio, muestreo, `angle_unit`),
 * conectado a `POST /graph/2d`. `GraphViewer` se carga vía `React.lazy`
 * (import dinámico real de Plotly — nunca en el bundle principal, Módulo
 * 12) solo cuando hay `graph_data` que mostrar.
 */

import { lazy, Suspense, useState, type FormEvent } from "react";

import type { MathResponse } from "../api/client";
import { submitAndRecord } from "../api/submitWithHistory";
import { useUIStore } from "../store/useUIStore";
import { ImplicitMultiplicationHint } from "./ImplicitMultiplicationHint";
import { ResultPanel } from "./ResultPanel";

const GraphViewer = lazy(() => import("./GraphViewer"));

const MAX_EXPRESSIONS = 5;

export function GraphMode() {
  const [expressions, setExpressions] = useState<string[]>([""]);
  const [variable, setVariable] = useState("x");
  const [xMin, setXMin] = useState("");
  const [xMax, setXMax] = useState("");
  const [samples, setSamples] = useState("");
  const [angleUnit, setAngleUnit] = useState<"rad" | "deg">("rad");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<MathResponse | null>(null);

  const setLoading = useUIStore((state) => state.setLoading);
  const setErrorMessage = useUIStore((state) => state.setErrorMessage);
  const isLoading = useUIStore((state) => state.isLoading);

  function updateExpression(index: number, value: string): void {
    setExpressions((current) => current.map((expr, i) => (i === index ? value : expr)));
  }

  function addExpressionField(): void {
    setExpressions((current) => (current.length < MAX_EXPRESSIONS ? [...current, ""] : current));
  }

  function removeExpressionField(index: number): void {
    setExpressions((current) => current.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmedExpressions = expressions.map((expr) => expr.trim()).filter(Boolean);

    if (trimmedExpressions.length === 0) {
      setValidationError("Debes ingresar al menos una expresión.");
      return;
    }
    const trimmedXMin = xMin.trim();
    const trimmedXMax = xMax.trim();
    if ((trimmedXMin === "") !== (trimmedXMax === "")) {
      setValidationError("x_min y x_max deben especificarse juntos o ninguno.");
      return;
    }
    setValidationError(null);

    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await submitAndRecord(
        "/graph/2d",
        {
          expressions: trimmedExpressions,
          variable: variable.trim() || "x",
          angle_unit: angleUnit,
          ...(trimmedXMin !== "" ? { x_min: Number(trimmedXMin), x_max: Number(trimmedXMax) } : {}),
          ...(samples.trim() !== "" ? { samples: Number(samples.trim()) } : {}),
        },
        trimmedExpressions.join(", "),
      );
      setLastResult(result);
      if (!result.success) {
        setErrorMessage(result.error_message ?? "Ocurrió un error.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-labelledby="graph-mode-heading" className="space-y-4">
      <h2 id="graph-mode-heading" className="text-sm font-medium text-slate-300">
        Gráficas
      </h2>

      <div className="space-y-2">
        <span className="block text-sm text-slate-300">Expresiones (hasta {MAX_EXPRESSIONS})</span>
        {expressions.map((expr, index) => (
          <div key={index} className="flex gap-2">
            <input
              aria-label={`Expresión ${index + 1}`}
              value={expr}
              onChange={(e) => updateExpression(index, e.target.value)}
              className="flex-1 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
            />
            {expressions.length > 1 && (
              <button
                type="button"
                onClick={() => removeExpressionField(index)}
                aria-label={`Eliminar expresión ${index + 1}`}
                className="text-sm text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <ImplicitMultiplicationHint />
        {expressions.length < MAX_EXPRESSIONS && (
          <button
            type="button"
            onClick={addExpressionField}
            className="text-sm text-sky-400 hover:text-sky-300"
          >
            + Añadir expresión
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="space-y-1">
          <label htmlFor="graph-variable" className="block text-sm text-slate-300">
            Variable
          </label>
          <input
            id="graph-variable"
            type="text"
            value={variable}
            onChange={(e) => setVariable(e.target.value)}
            className="w-20 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="graph-x-min" className="block text-sm text-slate-300">
            x mínimo (opcional)
          </label>
          <input
            id="graph-x-min"
            type="text"
            value={xMin}
            onChange={(e) => setXMin(e.target.value)}
            className="w-24 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="graph-x-max" className="block text-sm text-slate-300">
            x máximo (opcional)
          </label>
          <input
            id="graph-x-max"
            type="text"
            value={xMax}
            onChange={(e) => setXMax(e.target.value)}
            className="w-24 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="graph-samples" className="block text-sm text-slate-300">
            Muestras (opcional)
          </label>
          <input
            id="graph-samples"
            type="text"
            value={samples}
            onChange={(e) => setSamples(e.target.value)}
            className="w-24 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="graph-angle-unit" className="block text-sm text-slate-300">
            Unidad angular
          </label>
          <select
            id="graph-angle-unit"
            value={angleUnit}
            onChange={(e) => setAngleUnit(e.target.value as "rad" | "deg")}
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
          >
            <option value="rad">Radianes</option>
            <option value="deg">Grados</option>
          </select>
        </div>
      </div>

      {validationError && (
        <p role="alert" className="text-sm text-red-400">
          {validationError}
        </p>
      )}

      <button
        type="submit"
        className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
      >
        Graficar
      </button>

      <div className="border-t border-slate-800 pt-4">
        {!isLoading && lastResult?.success && lastResult.graph_data ? (
          <Suspense
            fallback={<p className="text-sm text-slate-400">Cargando visor de gráficas…</p>}
          >
            <GraphViewer data={lastResult.graph_data} />
          </Suspense>
        ) : (
          <ResultPanel result={lastResult} isLoading={isLoading} />
        )}
      </div>
    </form>
  );
}
