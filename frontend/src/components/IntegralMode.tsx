/**
 * src/components/IntegralMode.tsx — modo Integral (spec, sección 11):
 * expresión + variable + límites opcionales (juntos o ninguno, sección 5),
 * conectado a `POST /integral`.
 */

import { useState, type FormEvent } from "react";

import type { MathResponse } from "../api/client";
import { submitAndRecord } from "../api/submitWithHistory";
import { useUIStore } from "../store/useUIStore";
import { ImplicitMultiplicationHint } from "./ImplicitMultiplicationHint";
import { ResultPanel } from "./ResultPanel";

export function IntegralMode() {
  const [expression, setExpression] = useState("");
  const [variable, setVariable] = useState("x");
  const [lowerBound, setLowerBound] = useState("");
  const [upperBound, setUpperBound] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<MathResponse | null>(null);

  const setLoading = useUIStore((state) => state.setLoading);
  const setErrorMessage = useUIStore((state) => state.setErrorMessage);
  const isLoading = useUIStore((state) => state.isLoading);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmedExpression = expression.trim();
    const trimmedLower = lowerBound.trim();
    const trimmedUpper = upperBound.trim();

    if (!trimmedExpression) {
      setValidationError("La expresión no puede estar vacía.");
      return;
    }
    if ((trimmedLower === "") !== (trimmedUpper === "")) {
      setValidationError("Los límites deben especificarse juntos o ninguno.");
      return;
    }
    setValidationError(null);

    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await submitAndRecord(
        "/integral",
        {
          expression: trimmedExpression,
          variable: variable.trim() || "x",
          ...(trimmedLower !== "" ? { lower_bound: trimmedLower, upper_bound: trimmedUpper } : {}),
        },
        `∫ ${trimmedExpression}`,
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
    <form onSubmit={handleSubmit} aria-labelledby="integral-mode-heading" className="space-y-4 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
      <h2 id="integral-mode-heading" className="text-sm font-medium text-stone-600">
        Integral
      </h2>

      <div className="space-y-1">
        <label htmlFor="integral-expression" className="block text-sm text-stone-600">
          Expresión
        </label>
        <input
          id="integral-expression"
          type="text"
          value={expression}
          onChange={(e) => setExpression(e.target.value)}
          aria-describedby="integral-expression-hint"
          className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm"
        />
        <div id="integral-expression-hint">
          <ImplicitMultiplicationHint />
        </div>
      </div>

      <div className="flex gap-4">
        <div className="space-y-1">
          <label htmlFor="integral-variable" className="block text-sm text-stone-600">
            Variable
          </label>
          <input
            id="integral-variable"
            type="text"
            value={variable}
            onChange={(e) => setVariable(e.target.value)}
            className="w-20 rounded border border-stone-300 bg-white px-2 py-1 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="integral-lower" className="block text-sm text-stone-600">
            Límite inferior (opcional)
          </label>
          <input
            id="integral-lower"
            type="text"
            value={lowerBound}
            onChange={(e) => setLowerBound(e.target.value)}
            className="w-24 rounded border border-stone-300 bg-white px-2 py-1 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="integral-upper" className="block text-sm text-stone-600">
            Límite superior (opcional)
          </label>
          <input
            id="integral-upper"
            type="text"
            value={upperBound}
            onChange={(e) => setUpperBound(e.target.value)}
            className="w-24 rounded border border-stone-300 bg-white px-2 py-1 text-sm"
          />
        </div>
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
        Integrar
      </button>

      <div className="border-t border-stone-200 pt-4">
        <ResultPanel result={lastResult} isLoading={isLoading} />
      </div>
    </form>
  );
}
