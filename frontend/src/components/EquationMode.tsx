/**
 * src/components/EquationMode.tsx — modo Ecuación (spec, sección 11):
 * ecuación + variable OPCIONAL (con ayuda visible sobre inferencia
 * automática) + `angle_unit`, conectado a `POST /solve`.
 */

import { useState, type FormEvent } from "react";

import type { MathResponse } from "../api/client";
import { submitAndRecord } from "../api/submitWithHistory";
import { useUIStore } from "../store/useUIStore";
import { ImplicitMultiplicationHint } from "./ImplicitMultiplicationHint";
import { ResultPanel } from "./ResultPanel";

export function EquationMode() {
  const [equation, setEquation] = useState("");
  const [variable, setVariable] = useState("");
  const [angleUnit, setAngleUnit] = useState<"rad" | "deg">("rad");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<MathResponse | null>(null);

  const setLoading = useUIStore((state) => state.setLoading);
  const setErrorMessage = useUIStore((state) => state.setErrorMessage);
  const isLoading = useUIStore((state) => state.isLoading);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmedEquation = equation.trim();
    if (!trimmedEquation) {
      setValidationError("La ecuación no puede estar vacía.");
      return;
    }
    setValidationError(null);

    const trimmedVariable = variable.trim();

    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await submitAndRecord(
        "/solve",
        {
          equation: trimmedEquation,
          angle_unit: angleUnit,
          ...(trimmedVariable ? { variable: trimmedVariable } : {}),
        },
        trimmedEquation,
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
    <form onSubmit={handleSubmit} aria-labelledby="equation-mode-heading" className="space-y-4 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
      <h2 id="equation-mode-heading" className="text-sm font-medium text-stone-600">
        Ecuación
      </h2>

      <div className="space-y-1">
        <label htmlFor="equation-input" className="block text-sm text-stone-600">
          Ecuación
        </label>
        <input
          id="equation-input"
          type="text"
          value={equation}
          onChange={(e) => setEquation(e.target.value)}
          aria-describedby="equation-expression-hint"
          className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm"
        />
        <div id="equation-expression-hint">
          <ImplicitMultiplicationHint />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="equation-variable" className="block text-sm text-stone-600">
          Variable a despejar (opcional)
        </label>
        <input
          id="equation-variable"
          type="text"
          value={variable}
          onChange={(e) => setVariable(e.target.value)}
          aria-describedby="equation-variable-hint"
          className="w-32 rounded border border-stone-300 bg-white px-2 py-1 text-sm"
        />
        <p id="equation-variable-hint" className="text-xs text-stone-400" role="note">
          Si la ecuación tiene una única variable libre, se infiere automáticamente. Si tiene más de
          una, hay que especificarla aquí.
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="equation-angle-unit" className="block text-sm text-stone-600">
          Unidad angular
        </label>
        <select
          id="equation-angle-unit"
          value={angleUnit}
          onChange={(e) => setAngleUnit(e.target.value as "rad" | "deg")}
          className="rounded border border-stone-300 bg-white px-2 py-1 text-sm"
        >
          <option value="rad">Radianes</option>
          <option value="deg">Grados</option>
        </select>
      </div>

      {validationError && (
        <p role="alert" className="text-sm text-red-600">
          {validationError}
        </p>
      )}

      <button
        type="submit"
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
      >
        Resolver
      </button>

      <div className="border-t border-stone-200 pt-4">
        <ResultPanel result={lastResult} isLoading={isLoading} />
      </div>
    </form>
  );
}
