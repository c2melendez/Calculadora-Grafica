/**
 * src/components/EquationMode.tsx — modo Ecuación (spec, sección 11):
 * ecuación + variable OPCIONAL (con ayuda visible sobre inferencia
 * automática) + `angle_unit`, conectado a `POST /solve`.
 */

import { useRef, useState, type FormEvent } from "react";

import type { MathResponse } from "../api/client";
import { submitAndRecord } from "../api/submitWithHistory";
import { useUIStore } from "../store/useUIStore";
import { latexToBackendSyntax, NaturalMathField } from "./NaturalMathField";
import { NaturalMathKeyboard } from "./NaturalMathKeyboard";
import { ResultPanel } from "./ResultPanel";
import type { MathfieldElement } from "mathlive";

const INEQUALITY_OPERATOR_PATTERN = /[<>]/;

export function EquationMode() {
  const formRef = useRef<HTMLFormElement>(null);
  const [latex, setLatex] = useState("");
  const [mathField, setMathField] = useState<MathfieldElement | null>(null);
  const [variable, setVariable] = useState("");
  const [angleUnit, setAngleUnit] = useState<"rad" | "deg">("rad");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<MathResponse | null>(null);

  const setLoading = useUIStore((state) => state.setLoading);
  const setErrorMessage = useUIStore((state) => state.setErrorMessage);
  const isLoading = useUIStore((state) => state.isLoading);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmedEquation = latexToBackendSyntax(latex);
    if (!trimmedEquation) {
      setValidationError("La ecuación no puede estar vacía.");
      return;
    }
    setValidationError(null);

    const trimmedVariable = variable.trim();

    setLoading(true);
    setErrorMessage(null);
    try {
      const isInequality = INEQUALITY_OPERATOR_PATTERN.test(trimmedEquation);

      const result = isInequality
        ? await submitAndRecord(
            "/inequality",
            {
              inequality: trimmedEquation,
              ...(trimmedVariable ? { variable: trimmedVariable } : {}),
            },
            trimmedEquation,
          )
        : await submitAndRecord(
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
    <form ref={formRef} onSubmit={handleSubmit} aria-labelledby="equation-mode-heading" className="space-y-4 rounded-lg border border-paper-line bg-paper-soft p-5 shadow-sm">
      <h2 id="equation-mode-heading" className="text-sm font-medium text-muted">
        Ecuación
      </h2>

      <div className="space-y-1">
        <NaturalMathField
          latex={latex}
          onLatexChange={setLatex}
          ariaLabel="Ecuación"
          placeholder="2x+1=5  (o  x+3>0 para desigualdades)"
          fieldRef={setMathField}
        />
        <NaturalMathKeyboard field={mathField} onSubmit={() => formRef.current?.requestSubmit()} />
        <p className="px-1 text-xs text-muted" role="note">
          Escribe = para resolver una ecuación, o &lt;, &gt;, ≤, ≥ para una desigualdad — se
          detecta automáticamente.
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="equation-variable" className="block text-sm text-muted">
          Variable a despejar (opcional)
        </label>
        <input
          id="equation-variable"
          type="text"
          value={variable}
          onChange={(e) => setVariable(e.target.value)}
          aria-describedby="equation-variable-hint"
          className="w-32 rounded border border-paper-line bg-paper-soft px-2 py-1 text-sm"
        />
        <p id="equation-variable-hint" className="text-xs text-muted" role="note">
          Si la ecuación tiene una única variable libre, se infiere automáticamente. Si tiene más de
          una, hay que especificarla aquí.
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="equation-angle-unit" className="block text-sm text-muted">
          Unidad angular
        </label>
        <select
          id="equation-angle-unit"
          value={angleUnit}
          onChange={(e) => setAngleUnit(e.target.value as "rad" | "deg")}
          className="rounded border border-paper-line bg-paper-soft px-2 py-1 text-sm"
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
        className="rounded bg-graph px-4 py-2 text-sm font-medium text-white hover:bg-graph/90"
      >
        Resolver
      </button>

      <div className="border-t border-paper-line pt-4">
        <ResultPanel result={lastResult} isLoading={isLoading} />
      </div>
    </form>
  );
}
