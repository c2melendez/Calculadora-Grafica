/**
 * src/components/IntegralMode.tsx — modo Integral (spec, sección 11):
 * expresión + variable + límites opcionales (juntos o ninguno, sección 5),
 * conectado a `POST /integral`.
 */

import { useRef, useState, type FormEvent } from "react";

import type { MathResponse } from "../api/client";
import { submitAndRecord } from "../api/submitWithHistory";
import { useUIStore } from "../store/useUIStore";
import { latexToBackendSyntax, NaturalMathField } from "./NaturalMathField";
import { NaturalMathKeyboard } from "./NaturalMathKeyboard";
import { ResultPanel } from "./ResultPanel";
import type { MathfieldElement } from "mathlive";

const INFINITE_BOUND_PATTERN = /^-?oo$/;

export function IntegralMode() {
  const formRef = useRef<HTMLFormElement>(null);
  const [latex, setLatex] = useState("");
  const [mathField, setMathField] = useState<MathfieldElement | null>(null);
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
    const trimmedExpression = latexToBackendSyntax(latex);
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
      const isImproper =
        trimmedLower !== "" &&
        (INFINITE_BOUND_PATTERN.test(trimmedLower) || INFINITE_BOUND_PATTERN.test(trimmedUpper));

      const result = isImproper
        ? await submitAndRecord(
            "/integral/improper",
            {
              expression: trimmedExpression,
              variable: variable.trim() || "x",
              lower_bound: trimmedLower,
              upper_bound: trimmedUpper,
            },
            `∫ ${trimmedExpression} (impropia)`,
          )
        : await submitAndRecord(
            "/integral",
            {
              expression: trimmedExpression,
              variable: variable.trim() || "x",
              ...(trimmedLower !== ""
                ? { lower_bound: trimmedLower, upper_bound: trimmedUpper }
                : {}),
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
    <form ref={formRef} onSubmit={handleSubmit} aria-labelledby="integral-mode-heading" className="space-y-4 rounded-lg border border-paper-line bg-paper-soft p-5 shadow-sm">
      <h2 id="integral-mode-heading" className="text-sm font-medium text-muted">
        Integral
      </h2>

      <div className="space-y-1">
        <NaturalMathField
          latex={latex}
          onLatexChange={setLatex}
          ariaLabel="Expresión"
          placeholder="x^2"
          fieldRef={setMathField}
        />
        <NaturalMathKeyboard field={mathField} onSubmit={() => formRef.current?.requestSubmit()} />
      </div>

      <div className="flex gap-4">
        <div className="space-y-1">
          <label htmlFor="integral-variable" className="block text-sm text-muted">
            Variable
          </label>
          <input
            id="integral-variable"
            type="text"
            value={variable}
            onChange={(e) => setVariable(e.target.value)}
            className="w-20 rounded border border-paper-line bg-paper-soft px-2 py-1 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="integral-lower" className="block text-sm text-muted">
            Límite inferior (opcional; "oo"/"-oo" para impropia)
          </label>
          <input
            id="integral-lower"
            type="text"
            value={lowerBound}
            onChange={(e) => setLowerBound(e.target.value)}
            className="w-24 rounded border border-paper-line bg-paper-soft px-2 py-1 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="integral-upper" className="block text-sm text-muted">
            Límite superior (opcional)
          </label>
          <input
            id="integral-upper"
            type="text"
            value={upperBound}
            onChange={(e) => setUpperBound(e.target.value)}
            className="w-24 rounded border border-paper-line bg-paper-soft px-2 py-1 text-sm"
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
        className="rounded bg-graph px-4 py-2 text-sm font-medium text-white hover:bg-graph/90"
      >
        Integrar
      </button>

      <div className="border-t border-paper-line pt-4">
        <ResultPanel result={lastResult} isLoading={isLoading} />
      </div>
    </form>
  );
}
