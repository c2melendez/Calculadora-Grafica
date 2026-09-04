/**
 * src/components/SystemMode.tsx — modo Sistemas de ecuaciones: N
 * ecuaciones + N variables, conectado a `POST /solve/system`
 * (`phase2_service.compute_solve_system` — lineal vía `linsolve`, no
 * lineal vía `solve`).
 */

import { useRef, useState, type FormEvent } from "react";
import type { MathfieldElement } from "mathlive";

import type { MathResponse } from "../api/client";
import { submitAndRecord } from "../api/submitWithHistory";
import { useUIStore } from "../store/useUIStore";
import { latexToBackendSyntax, NaturalMathField } from "./NaturalMathField";
import { NaturalMathKeyboard } from "./NaturalMathKeyboard";
import { ResultPanel } from "./ResultPanel";

const MIN_EQUATIONS = 2;
const MAX_EQUATIONS = 6;

export function SystemMode() {
  const formRef = useRef<HTMLFormElement>(null);
  const [latexRows, setLatexRows] = useState<string[]>(["", ""]);
  const [mathFields, setMathFields] = useState<(MathfieldElement | null)[]>([null, null]);
  const [activeRow, setActiveRow] = useState(0);
  const [variables, setVariables] = useState("x, y");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<MathResponse | null>(null);

  const setLoading = useUIStore((state) => state.setLoading);
  const setErrorMessage = useUIStore((state) => state.setErrorMessage);
  const isLoading = useUIStore((state) => state.isLoading);
  const setActiveMode = useUIStore((state) => state.setActiveMode);

  function updateRow(index: number, value: string): void {
    setLatexRows((current) => current.map((row, i) => (i === index ? value : row)));
  }

  function addRow(): void {
    if (latexRows.length >= MAX_EQUATIONS) return;
    setLatexRows((current) => [...current, ""]);
    setMathFields((current) => [...current, null]);
  }

  function removeRow(index: number): void {
    if (latexRows.length <= MIN_EQUATIONS) return;
    setLatexRows((current) => current.filter((_, i) => i !== index));
    setMathFields((current) => current.filter((_, i) => i !== index));
    setActiveRow((current) => Math.min(current, latexRows.length - 2));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const equations = latexRows.map((row) => latexToBackendSyntax(row));
    if (equations.some((eq) => eq === "")) {
      setValidationError("Todas las ecuaciones deben tener contenido.");
      return;
    }
    if (equations.some((eq) => !eq.includes("="))) {
      setValidationError("Cada ecuación debe incluir un signo =.");
      return;
    }

    const variableList = variables
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (variableList.length === 0) {
      setValidationError("Debes indicar al menos una variable.");
      return;
    }
    if (variableList.length !== equations.length) {
      setValidationError(
        `El número de variables (${variableList.length}) debe coincidir con el de ecuaciones (${equations.length}).`,
      );
      return;
    }
    setValidationError(null);

    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await submitAndRecord(
        "/solve/system",
        { equations, variables: variableList },
        `Sistema: ${equations.join(" ; ")}`,
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
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      aria-labelledby="system-mode-heading"
      className="rounded-lg border border-paper-line p-5 shadow-sm lg:grid lg:max-w-4xl lg:grid-cols-[1.4fr_1fr] lg:items-start lg:gap-6 dt:mx-auto dt:gap-10"
    >
      <div className="space-y-4 lg:col-start-1">
        <h2 id="system-mode-heading" className="text-sm font-medium text-muted">
          Sistema de ecuaciones
        </h2>

        <div className="space-y-2">
          <span className="block text-sm text-muted">Ecuaciones</span>
          {latexRows.map((row, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="flex-1">
                <NaturalMathField
                  latex={row}
                  onLatexChange={(value) => updateRow(index, value)}
                  ariaLabel={`Ecuación ${index + 1}`}
                  placeholder="x+y=5"
                  fieldRef={(el) =>
                    setMathFields((current) => current.map((f, i) => (i === index ? el : f)))
                  }
                />
              </div>
              {latexRows.length > MIN_EQUATIONS && (
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  aria-label={`Eliminar ecuación ${index + 1}`}
                  className="text-sm text-muted hover:text-ink"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {latexRows.length < MAX_EQUATIONS && (
            <button
              type="button"
              onClick={addRow}
              className="text-sm text-marker hover:text-marker-text"
            >
              + Añadir ecuación
            </button>
          )}
        </div>

        <div className="space-y-1">
          <span className="block text-xs font-medium text-muted">
            Teclado para la ecuación seleccionada:
          </span>
          <div className="flex flex-wrap gap-1">
            {latexRows.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setActiveRow(index)}
                aria-pressed={activeRow === index}
                className={`rounded px-2 py-1 text-xs ${
                  activeRow === index
                    ? "bg-graph text-white"
                    : "border border-paper-line text-muted hover:bg-paper"
                }`}
              >
                #{index + 1}
              </button>
            ))}
          </div>
          <NaturalMathKeyboard
            field={mathFields[activeRow] ?? null}
            onSubmit={() => formRef.current?.requestSubmit()}
            onGoToDerivative={() => setActiveMode("derivative")}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="system-variables" className="block text-sm text-muted">
            Variables (separadas por coma, en el mismo orden que se resolverán)
          </label>
          <input
            id="system-variables"
            type="text"
            value={variables}
            onChange={(e) => setVariables(e.target.value)}
            className="w-full rounded border border-paper-line bg-paper-soft px-3 py-2 text-sm"
          />
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
          Resolver sistema
        </button>
      </div>

      <div className="mt-4 lg:col-start-2 lg:mt-0">
        <div className="rounded-xl bg-paper-soft px-4 py-3 shadow-inner shadow-black/10">
          <ResultPanel result={lastResult} isLoading={isLoading} />
        </div>
      </div>
    </form>
  );
}
