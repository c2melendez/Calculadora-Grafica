/**
 * src/components/SimpleBasicMode.tsx — modo Basic (Fase B, spec UX
 * estilo ClassCalc §5): calculadora de 4 operaciones. No existía en
 * ningún proyecto (confirmado en auditoría) — construido desde cero,
 * modelado sobre BasicMode.tsx pero con SimpleKeyboard en vez de
 * NaturalMathKeyboard, y ya con los tokens Precision Lab (BasicMode.tsx
 * en sí sigue con la paleta stone/blue anterior a la Fase 1 — deuda
 * pendiente fuera del alcance de este archivo).
 */

import { useRef, useState, type FormEvent } from "react";
import type { MathfieldElement } from "mathlive";

import type { MathResponse } from "../api/client";
import { submitAndRecord } from "../api/submitWithHistory";
import { useUIStore } from "../store/useUIStore";
import { latexToBackendSyntax, NaturalMathField } from "./NaturalMathField";
import { SimpleKeyboard } from "./SimpleKeyboard";
import { ResultPanel } from "./ResultPanel";

export function SimpleBasicMode() {
  const formRef = useRef<HTMLFormElement>(null);
  const [mathField, setMathField] = useState<MathfieldElement | null>(null);
  const [latex, setLatex] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<MathResponse | null>(null);

  const setLoading = useUIStore((state) => state.setLoading);
  const setErrorMessage = useUIStore((state) => state.setErrorMessage);
  const isLoading = useUIStore((state) => state.isLoading);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmed = latexToBackendSyntax(latex);
    if (!trimmed) {
      setValidationError("La expresión no puede estar vacía.");
      return;
    }
    setValidationError(null);

    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await submitAndRecord("/evaluate", { expression: trimmed, angle_unit: "rad" }, trimmed);
      setLastResult(result);
      if (!result.success) {
        setErrorMessage(result.error_message ?? "Ocurrió un error.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} aria-labelledby="simple-basic-heading" className="mx-auto max-w-sm space-y-3 lg:max-w-3xl lg:grid lg:grid-cols-[1.4fr_1fr] lg:items-start lg:gap-6 lg:space-y-0 dt:gap-10">
      <h2 id="simple-basic-heading" className="sr-only">
        Basic
      </h2>

      <div className="flex flex-col gap-3 lg:col-start-1">
        <NaturalMathField latex={latex} onLatexChange={setLatex} ariaLabel="Expresión" placeholder="0" fieldRef={setMathField} />
        {validationError && (
          <p role="alert" className="px-2 text-sm text-red-600">
            {validationError}
          </p>
        )}
        <SimpleKeyboard field={mathField} onSubmit={() => formRef.current?.requestSubmit()} />
      </div>

      {(isLoading || lastResult) && (
        <div className="rounded-lg bg-paper-soft p-4 lg:col-start-2">
          <ResultPanel result={lastResult} isLoading={isLoading} />
        </div>
      )}
    </form>
  );
}
