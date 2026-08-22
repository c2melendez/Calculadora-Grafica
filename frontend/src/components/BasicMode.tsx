/**
 * src/components/BasicMode.tsx — modo Básico (spec, sección 11): campo de
 * expresión + `substitutions` (pares nombre/valor) + `angle_unit`,
 * conectado a `POST /evaluate`.
 */

import { useRef, useState, type FormEvent } from "react";

import type { MathResponse } from "../api/client";
import { submitAndRecord } from "../api/submitWithHistory";
import { useUIStore } from "../store/useUIStore";
import { ImplicitMultiplicationHint } from "./ImplicitMultiplicationHint";
import { MathKeyboard } from "./MathKeyboard";
import { ResultPanel } from "./ResultPanel";

interface SubstitutionRow {
  name: string;
  value: string;
}

const EXAMPLES = ["2*x + sqrt(9)", "sin(pi/4)", "(3+4)**2", "log(100)"];

export function BasicMode() {
  const formRef = useRef<HTMLFormElement>(null);
  const [expression, setExpression] = useState("");
  const [angleUnit, setAngleUnit] = useState<"rad" | "deg">("rad");
  const [substitutions, setSubstitutions] = useState<SubstitutionRow[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<MathResponse | null>(null);

  const setLoading = useUIStore((state) => state.setLoading);
  const setErrorMessage = useUIStore((state) => state.setErrorMessage);
  const isLoading = useUIStore((state) => state.isLoading);

  function addSubstitutionRow(): void {
    setSubstitutions((rows) => [...rows, { name: "", value: "" }]);
  }

  function updateSubstitutionRow(index: number, field: keyof SubstitutionRow, value: string): void {
    setSubstitutions((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  }

  function removeSubstitutionRow(index: number): void {
    setSubstitutions((rows) => rows.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmed = expression.trim();
    if (!trimmed) {
      setValidationError("La expresión no puede estar vacía.");
      return;
    }
    setValidationError(null);

    const substitutionsPayload =
      substitutions.length > 0
        ? Object.fromEntries(
            substitutions
              .filter((row) => row.name.trim() !== "")
              .map((row) => [row.name, row.value]),
          )
        : undefined;

    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await submitAndRecord(
        "/evaluate",
        {
          expression: trimmed,
          angle_unit: angleUnit,
          ...(substitutionsPayload ? { substitutions: substitutionsPayload } : {}),
        },
        trimmed,
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
    <form ref={formRef} onSubmit={handleSubmit} aria-labelledby="basic-mode-heading" className="space-y-6">
      <h2 id="basic-mode-heading" className="sr-only">
        Básico
      </h2>

      <div>
        <label htmlFor="basic-expression" className="sr-only">
          Expresión
        </label>
        <div className="relative">
          <input
            id="basic-expression"
            type="text"
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            placeholder="Ingresa un problema, p. ej. 2*x + sqrt(9)"
            aria-describedby="basic-expression-hint"
            aria-invalid={validationError !== null}
            className="w-full rounded-full border border-stone-300 bg-white py-3 pl-5 pr-14 text-base text-stone-900 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          />
          <button
            type="submit"
            aria-label="Evaluar"
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-500"
          >
            →
          </button>
        </div>
        <div id="basic-expression-hint" className="mt-1.5 px-2">
          <ImplicitMultiplicationHint />
        </div>
        {validationError && (
          <p role="alert" className="mt-1 px-2 text-sm text-red-600">
            {validationError}
          </p>
        )}
      </div>

      <MathKeyboard
        value={expression}
        onChange={setExpression}
        inputId="basic-expression"
        onSubmit={() => formRef.current?.requestSubmit()}
      />

      <div className="flex flex-wrap gap-2">
        <span className="pt-1.5 text-xs font-medium text-stone-400">Ejemplos:</span>
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setExpression(example)}
            className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs text-stone-600 hover:border-blue-300 hover:text-blue-600"
          >
            {example}
          </button>
        ))}
      </div>

      <details className="group rounded-lg border border-stone-200 bg-white open:pb-3">
        <summary className="cursor-pointer list-none px-4 py-2.5 text-sm font-medium text-stone-600 marker:content-none">
          Opciones avanzadas (sustituciones, unidad angular)
        </summary>
        <div className="space-y-4 px-4 pt-1">
          <div className="space-y-2">
            <span className="block text-sm text-stone-600">Sustituciones (opcional)</span>
            {substitutions.map((row, index) => (
              <div key={index} className="flex gap-2">
                <input
                  aria-label={`Nombre de la variable ${index + 1}`}
                  value={row.name}
                  onChange={(e) => updateSubstitutionRow(index, "name", e.target.value)}
                  className="w-24 rounded border border-stone-300 bg-white px-2 py-1 text-sm text-stone-900"
                />
                <input
                  aria-label={`Valor de la variable ${index + 1}`}
                  value={row.value}
                  onChange={(e) => updateSubstitutionRow(index, "value", e.target.value)}
                  className="w-24 rounded border border-stone-300 bg-white px-2 py-1 text-sm text-stone-900"
                />
                <button
                  type="button"
                  onClick={() => removeSubstitutionRow(index)}
                  aria-label={`Eliminar sustitución ${index + 1}`}
                  className="text-sm text-stone-400 hover:text-stone-600"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addSubstitutionRow}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              + Añadir sustitución
            </button>
          </div>

          <div className="space-y-1">
            <label htmlFor="basic-angle-unit" className="block text-sm text-stone-600">
              Unidad angular
            </label>
            <select
              id="basic-angle-unit"
              value={angleUnit}
              onChange={(e) => setAngleUnit(e.target.value as "rad" | "deg")}
              className="rounded border border-stone-300 bg-white px-2 py-1 text-sm text-stone-900"
            >
              <option value="rad">Radianes</option>
              <option value="deg">Grados</option>
            </select>
          </div>
        </div>
      </details>

      {(isLoading || lastResult) && (
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <ResultPanel result={lastResult} isLoading={isLoading} />
        </div>
      )}
    </form>
  );
}
