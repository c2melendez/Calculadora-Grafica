/**
 * src/components/BasicMode.tsx — modo Básico (spec, sección 11): campo de
 * expresión + `substitutions` (pares nombre/valor) + `angle_unit`,
 * conectado a `POST /evaluate`.
 */

import { useRef, useState, type FormEvent } from "react";
import type { MathfieldElement } from "mathlive";

import type { MathResponse } from "../api/client";
import { submitAndRecord } from "../api/submitWithHistory";
import { useUIStore } from "../store/useUIStore";
import { latexToBackendSyntax, NaturalMathField } from "./NaturalMathField";
import { NaturalMathKeyboard } from "./NaturalMathKeyboard";
import { ResultPanel } from "./ResultPanel";

interface SubstitutionRow {
  name: string;
  value: string;
}

const EXAMPLES: { display: string; latex: string }[] = [
  { display: "2x + √9", latex: "2x+\\sqrt{9}" },
  { display: "sin(π/4)", latex: "\\sin\\left(\\frac{\\pi}{4}\\right)" },
  { display: "(3+4)²", latex: "(3+4)^{2}" },
  { display: "log(100)", latex: "\\log\\left(100\\right)" },
];

export function BasicMode() {
  const formRef = useRef<HTMLFormElement>(null);
  const [mathField, setMathField] = useState<MathfieldElement | null>(null);
  const [latex, setLatex] = useState("");
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
    const trimmed = latexToBackendSyntax(latex);
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
        <div className="relative">
          <NaturalMathField
            latex={latex}
            onLatexChange={setLatex}
            ariaLabel="Expresión"
            placeholder="2x + √9"
            fieldRef={setMathField}
          />
          <button
            type="submit"
            aria-label="Evaluar"
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-graph text-white hover:bg-graph/90"
          >
            →
          </button>
        </div>
        {validationError && (
          <p role="alert" className="mt-1 px-2 text-sm text-red-600">
            {validationError}
          </p>
        )}
      </div>

      <NaturalMathKeyboard field={mathField} onSubmit={() => formRef.current?.requestSubmit()} />

      <div className="flex flex-wrap gap-2">
        <span className="pt-1.5 text-xs font-medium text-muted">Ejemplos:</span>
        {EXAMPLES.map((example) => (
          <button
            key={example.display}
            type="button"
            onClick={() => setLatex(example.latex)}
            className="rounded-full border border-paper-line bg-paper-soft px-3 py-1 text-xs text-muted hover:border-marker/40 hover:text-marker"
          >
            {example.display}
          </button>
        ))}
      </div>

      <details className="group rounded-lg border border-paper-line bg-paper-soft open:pb-3">
        <summary className="cursor-pointer list-none px-4 py-2.5 text-sm font-medium text-muted marker:content-none">
          Opciones avanzadas (sustituciones, unidad angular)
        </summary>
        <div className="space-y-4 px-4 pt-1">
          <div className="space-y-2">
            <span className="block text-sm text-muted">Sustituciones (opcional)</span>
            {substitutions.map((row, index) => (
              <div key={index} className="flex gap-2">
                <input
                  aria-label={`Nombre de la variable ${index + 1}`}
                  value={row.name}
                  onChange={(e) => updateSubstitutionRow(index, "name", e.target.value)}
                  className="w-24 rounded border border-paper-line bg-paper-soft px-2 py-1 text-sm text-ink"
                />
                <input
                  aria-label={`Valor de la variable ${index + 1}`}
                  value={row.value}
                  onChange={(e) => updateSubstitutionRow(index, "value", e.target.value)}
                  className="w-24 rounded border border-paper-line bg-paper-soft px-2 py-1 text-sm text-ink"
                />
                <button
                  type="button"
                  onClick={() => removeSubstitutionRow(index)}
                  aria-label={`Eliminar sustitución ${index + 1}`}
                  className="text-sm text-muted hover:text-muted"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addSubstitutionRow}
              className="text-sm text-marker hover:text-marker-text"
            >
              + Añadir sustitución
            </button>
          </div>

          <div className="space-y-1">
            <label htmlFor="basic-angle-unit" className="block text-sm text-muted">
              Unidad angular
            </label>
            <select
              id="basic-angle-unit"
              value={angleUnit}
              onChange={(e) => setAngleUnit(e.target.value as "rad" | "deg")}
              className="rounded border border-paper-line bg-paper-soft px-2 py-1 text-sm text-ink"
            >
              <option value="rad">Radianes</option>
              <option value="deg">Grados</option>
            </select>
          </div>
        </div>
      </details>

      {(isLoading || lastResult) && (
        <div className="rounded-lg border border-paper-line bg-paper-soft p-4 shadow-sm">
          <ResultPanel result={lastResult} isLoading={isLoading} />
        </div>
      )}
    </form>
  );
}
