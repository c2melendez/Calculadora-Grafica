/**
 * src/components/BasicMode.tsx — modo Básico (spec, sección 11): campo de
 * expresión + `substitutions` (pares nombre/valor) + `angle_unit`,
 * conectado a `POST /evaluate`.
 */

import { useState, type FormEvent } from "react";

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

export function BasicMode() {
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
    <form onSubmit={handleSubmit} aria-labelledby="basic-mode-heading" className="space-y-4">
      <h2 id="basic-mode-heading" className="text-sm font-medium text-slate-300">
        Básico
      </h2>

      <div className="space-y-1">
        <label htmlFor="basic-expression" className="block text-sm text-slate-300">
          Expresión
        </label>
        <input
          id="basic-expression"
          type="text"
          value={expression}
          onChange={(e) => setExpression(e.target.value)}
          aria-describedby="basic-expression-hint"
          aria-invalid={validationError !== null}
          className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
        />
        <div id="basic-expression-hint">
          <ImplicitMultiplicationHint />
        </div>
        {validationError && (
          <p role="alert" className="text-sm text-red-400">
            {validationError}
          </p>
        )}
        <MathKeyboard value={expression} onChange={setExpression} inputId="basic-expression" />
      </div>

      <div className="space-y-2">
        <span className="block text-sm text-slate-300">Sustituciones (opcional)</span>
        {substitutions.map((row, index) => (
          <div key={index} className="flex gap-2">
            <input
              aria-label={`Nombre de la variable ${index + 1}`}
              value={row.name}
              onChange={(e) => updateSubstitutionRow(index, "name", e.target.value)}
              className="w-24 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
            />
            <input
              aria-label={`Valor de la variable ${index + 1}`}
              value={row.value}
              onChange={(e) => updateSubstitutionRow(index, "value", e.target.value)}
              className="w-24 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={() => removeSubstitutionRow(index)}
              aria-label={`Eliminar sustitución ${index + 1}`}
              className="text-sm text-slate-400 hover:text-slate-200"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addSubstitutionRow}
          className="text-sm text-sky-400 hover:text-sky-300"
        >
          + Añadir sustitución
        </button>
      </div>

      <div className="space-y-1">
        <label htmlFor="basic-angle-unit" className="block text-sm text-slate-300">
          Unidad angular
        </label>
        <select
          id="basic-angle-unit"
          value={angleUnit}
          onChange={(e) => setAngleUnit(e.target.value as "rad" | "deg")}
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
        >
          <option value="rad">Radianes</option>
          <option value="deg">Grados</option>
        </select>
      </div>

      <button
        type="submit"
        className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
      >
        Evaluar
      </button>

      <div className="border-t border-slate-800 pt-4">
        <ResultPanel result={lastResult} isLoading={isLoading} />
      </div>
    </form>
  );
}
