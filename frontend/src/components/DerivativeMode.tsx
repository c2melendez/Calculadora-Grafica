/**
 * src/components/DerivativeMode.tsx — modo Derivada (spec, sección 11):
 * expresión + variable + orden (1-5), conectado a `POST /derivative`.
 */

import { useRef, useState, type FormEvent } from "react";

import type { MathResponse } from "../api/client";
import { submitAndRecord } from "../api/submitWithHistory";
import { useUIStore } from "../store/useUIStore";
import { latexToBackendSyntax, NaturalMathField } from "./NaturalMathField";
import { NaturalMathKeyboard } from "./NaturalMathKeyboard";
import { ResultPanel } from "./ResultPanel";
import type { MathfieldElement } from "mathlive";

export function DerivativeMode() {
  const formRef = useRef<HTMLFormElement>(null);
  const [isImplicit, setIsImplicit] = useState(false);
  const [latex, setLatex] = useState("");
  const [mathField, setMathField] = useState<MathfieldElement | null>(null);
  const [variable, setVariable] = useState("x");
  const [order, setOrder] = useState(1);
  const [dependentVariable, setDependentVariable] = useState("y");
  const [independentVariable, setIndependentVariable] = useState("x");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<MathResponse | null>(null);

  const setLoading = useUIStore((state) => state.setLoading);
  const setErrorMessage = useUIStore((state) => state.setErrorMessage);
  const isLoading = useUIStore((state) => state.isLoading);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmedExpression = latexToBackendSyntax(latex);

    if (!trimmedExpression) {
      setValidationError(
        isImplicit ? "La ecuación no puede estar vacía." : "La expresión no puede estar vacía.",
      );
      return;
    }

    if (isImplicit) {
      if (!trimmedExpression.includes("=")) {
        setValidationError("La derivada implícita necesita una ecuación con signo =.");
        return;
      }
      const trimmedDependent = dependentVariable.trim();
      const trimmedIndependent = independentVariable.trim();
      if (!trimmedDependent || !trimmedIndependent) {
        setValidationError("Debes indicar ambas variables (dependiente e independiente).");
        return;
      }
      setValidationError(null);

      setLoading(true);
      setErrorMessage(null);
      try {
        const result = await submitAndRecord(
          "/derivative/implicit",
          {
            equation: trimmedExpression,
            dependent_variable: trimmedDependent,
            independent_variable: trimmedIndependent,
          },
          `d${trimmedDependent}/d${trimmedIndependent} [${trimmedExpression}]`,
        );
        setLastResult(result);
        if (!result.success) {
          setErrorMessage(result.error_message ?? "Ocurrió un error.");
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    const trimmedVariable = variable.trim();
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
    <form ref={formRef} onSubmit={handleSubmit} aria-labelledby="derivative-mode-heading" className="space-y-4 rounded-lg border border-paper-line bg-paper-soft p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 id="derivative-mode-heading" className="text-sm font-medium text-muted">
          Derivada
        </h2>
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input
            type="checkbox"
            checked={isImplicit}
            onChange={(e) => setIsImplicit(e.target.checked)}
          />
          Derivada implícita (ecuación con dos variables)
        </label>
      </div>

      <div className="space-y-1">
        <NaturalMathField
          latex={latex}
          onLatexChange={setLatex}
          ariaLabel={isImplicit ? "Ecuación" : "Expresión"}
          placeholder={isImplicit ? "x^2+y^2=1" : "x^2"}
          fieldRef={setMathField}
        />
        <NaturalMathKeyboard field={mathField} onSubmit={() => formRef.current?.requestSubmit()} />
      </div>

      {isImplicit ? (
        <div className="flex gap-4">
          <div className="space-y-1">
            <label htmlFor="derivative-dependent" className="block text-sm text-muted">
              Variable dependiente
            </label>
            <input
              id="derivative-dependent"
              type="text"
              value={dependentVariable}
              onChange={(e) => setDependentVariable(e.target.value)}
              className="w-24 rounded border border-paper-line bg-paper-soft px-2 py-1 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="derivative-independent" className="block text-sm text-muted">
              Variable independiente
            </label>
            <input
              id="derivative-independent"
              type="text"
              value={independentVariable}
              onChange={(e) => setIndependentVariable(e.target.value)}
              className="w-24 rounded border border-paper-line bg-paper-soft px-2 py-1 text-sm"
            />
          </div>
        </div>
      ) : (
        <div className="flex gap-4">
          <div className="space-y-1">
            <label htmlFor="derivative-variable" className="block text-sm text-muted">
              Variable
            </label>
            <input
              id="derivative-variable"
              type="text"
              value={variable}
              onChange={(e) => setVariable(e.target.value)}
              className="w-20 rounded border border-paper-line bg-paper-soft px-2 py-1 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="derivative-order" className="block text-sm text-muted">
              Orden
            </label>
            <input
              id="derivative-order"
              type="number"
              min={1}
              max={5}
              value={order}
              onChange={(e) => setOrder(Number(e.target.value))}
              className="w-20 rounded border border-paper-line bg-paper-soft px-2 py-1 text-sm"
            />
          </div>
        </div>
      )}

      {validationError && (
        <p role="alert" className="text-sm text-red-600">
          {validationError}
        </p>
      )}

      <button
        type="submit"
        className="rounded bg-graph px-4 py-2 text-sm font-medium text-white hover:bg-graph/90"
      >
        Derivar
      </button>

      <div className="border-t border-paper-line pt-4">
        <ResultPanel result={lastResult} isLoading={isLoading} />
      </div>
    </form>
  );
}
