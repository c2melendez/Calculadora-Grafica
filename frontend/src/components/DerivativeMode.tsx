/**
 * src/components/DerivativeMode.tsx — modo Derivada (spec, sección 11):
 * expresión + variable + orden (1-5), conectado a `POST /derivative`.
 */

import { useState, type FormEvent } from "react";

import type { MathResponse } from "../api/client";
import { submitAndRecord } from "../api/submitWithHistory";
import { useUIStore } from "../store/useUIStore";
import { ImplicitMultiplicationHint } from "./ImplicitMultiplicationHint";
import { ResultPanel } from "./ResultPanel";

export function DerivativeMode() {
  const [expression, setExpression] = useState("");
  const [variable, setVariable] = useState("x");
  const [order, setOrder] = useState(1);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<MathResponse | null>(null);

  const setLoading = useUIStore((state) => state.setLoading);
  const setErrorMessage = useUIStore((state) => state.setErrorMessage);
  const isLoading = useUIStore((state) => state.isLoading);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmedExpression = expression.trim();
    const trimmedVariable = variable.trim();

    if (!trimmedExpression) {
      setValidationError("La expresión no puede estar vacía.");
      return;
    }
    if (!trimmedVariable) {
      setValidationError("La variable no puede estar vacía.");
      return;
    }
    if (!Number.isInteger(order) || order < 1 || order > 5) {
      setValidationError("El orden debe ser un entero entre 1 y 5.");
      return;
    }
    setValidationError(null);

    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await submitAndRecord(
        "/derivative",
        {
          expression: trimmedExpression,
          variable: trimmedVariable,
          order,
        },
        `d/d${trimmedVariable} [${trimmedExpression}]`,
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
    <form onSubmit={handleSubmit} aria-labelledby="derivative-mode-heading" className="space-y-4">
      <h2 id="derivative-mode-heading" className="text-sm font-medium text-slate-300">
        Derivada
      </h2>

      <div className="space-y-1">
        <label htmlFor="derivative-expression" className="block text-sm text-slate-300">
          Expresión
        </label>
        <input
          id="derivative-expression"
          type="text"
          value={expression}
          onChange={(e) => setExpression(e.target.value)}
          aria-describedby="derivative-expression-hint"
          className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
        />
        <div id="derivative-expression-hint">
          <ImplicitMultiplicationHint />
        </div>
      </div>

      <div className="flex gap-4">
        <div className="space-y-1">
          <label htmlFor="derivative-variable" className="block text-sm text-slate-300">
            Variable
          </label>
          <input
            id="derivative-variable"
            type="text"
            value={variable}
            onChange={(e) => setVariable(e.target.value)}
            className="w-20 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="derivative-order" className="block text-sm text-slate-300">
            Orden
          </label>
          <input
            id="derivative-order"
            type="number"
            min={1}
            max={5}
            value={order}
            onChange={(e) => setOrder(Number(e.target.value))}
            className="w-20 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
          />
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
        Derivar
      </button>

      <div className="border-t border-slate-800 pt-4">
        <ResultPanel result={lastResult} isLoading={isLoading} />
      </div>
    </form>
  );
}
