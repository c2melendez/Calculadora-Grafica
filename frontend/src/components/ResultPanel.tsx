/**
 * src/components/ResultPanel.tsx — panel de resultado (spec, sección 11).
 *
 * `has_detailed_steps: false` se muestra como "procedimiento resumido"
 * (nunca como ausencia de resultado — el resultado sigue siendo válido).
 * `warnings` siempre visibles. "Copiar resultado"/"Copiar como LaTeX"
 * (deshabilitado si `result_latex` es `null`). Notación científica para
 * `result_approx` extremo. `aria-live`/`aria-label` para accesibilidad.
 */

import { useState } from "react";

import type { EquationSolution, MathResponse } from "../api/client";
import { formatResultApprox } from "./formatNumber";
import { MathRenderer } from "./MathRenderer";
import { StepList } from "./StepList";

interface ResultPanelProps {
  result: MathResponse | null;
  isLoading: boolean;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function CopyButton({ text, label }: { text: string | null; label: string }) {
  const [justCopied, setJustCopied] = useState(false);

  async function handleClick(): Promise<void> {
    if (text === null) return;
    const ok = await copyToClipboard(text);
    if (ok) {
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 1500);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={text === null}
      className="rounded border border-stone-300 px-3 py-1 text-xs text-stone-600 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {justCopied ? "¡Copiado!" : label}
    </button>
  );
}

function isMatrixData(
  data: MathResponse["result_data"],
  resultType: MathResponse["result_type"],
): data is string[][] {
  return resultType === "matrix" && Array.isArray(data);
}

function isEquationSolutionData(
  data: MathResponse["result_data"],
  resultType: MathResponse["result_type"],
): data is EquationSolution[] {
  return resultType === "equation_solutions" && Array.isArray(data);
}

function MatrixResult({ matrix }: { matrix: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-1">
        <tbody>
          {matrix.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td
                  key={c}
                  className="min-w-[3rem] rounded border border-stone-200 bg-stone-50 px-3 py-2 text-center text-base text-stone-900"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SolutionListResult({ solutions }: { solutions: EquationSolution[] }) {
  if (solutions.length === 0) {
    return <p className="text-sm text-stone-500">El sistema no tiene solución.</p>;
  }
  return (
    <ul className="space-y-2">
      {solutions.map((solution, index) => (
        <li key={index} className="text-lg text-stone-900">
          <MathRenderer latex={solution.latex} fallbackText={solution.text} />
          {solution.is_complex && <span className="ml-2 text-xs text-stone-400">(compleja)</span>}
        </li>
      ))}
    </ul>
  );
}

export function ResultPanel({ result, isLoading }: ResultPanelProps) {
  if (isLoading) {
    return (
      <div role="status" aria-live="polite" className="text-sm text-stone-400">
        Calculando…
      </div>
    );
  }

  if (result === null) {
    return (
      <p className="text-sm text-stone-400">
        Introduce una expresión y envía el formulario para ver el resultado aquí.
      </p>
    );
  }

  if (!result.success) {
    return (
      <div role="alert" aria-live="assertive" className="text-sm text-red-600">
        <p className="font-medium">{result.error_code}</p>
        <p>{result.error_message}</p>
      </div>
    );
  }

  const matrixData = isMatrixData(result.result_data, result.result_type) ? result.result_data : null;
  const solutionData = isEquationSolutionData(result.result_data, result.result_type)
    ? result.result_data
    : null;
  const approxText = result.result_approx != null ? formatResultApprox(result.result_approx) : null;
  const copyText = result.result_text ?? approxText;

  return (
    <div aria-live="polite" className="space-y-4 fade-in">
      {matrixData && <MatrixResult matrix={matrixData} />}
      {solutionData && <SolutionListResult solutions={solutionData} />}

      {!matrixData && !solutionData && (result.result_latex || result.result_text) && (
        <div className="space-y-1">
          {result.result_latex ? (
            <MathRenderer
              latex={result.result_latex}
              fallbackText={result.result_text ?? undefined}
              className="text-lg"
            />
          ) : (
            <p className="text-lg text-stone-900">{result.result_text}</p>
          )}
          {/* Fracción exacta (arriba) y decimal (abajo) mostrados juntos —
              nunca uno oculta al otro (sección 9: fracciones + su
              equivalente decimal). */}
          {approxText && approxText !== result.result_text && (
            <p className="text-sm text-stone-500">≈ {approxText}</p>
          )}
        </div>
      )}

      {!result.has_detailed_steps && (
        <p className="text-xs text-amber-600">Procedimiento resumido (sin desglose paso a paso).</p>
      )}

      {result.warnings.length > 0 && (
        <ul className="space-y-1 text-xs text-amber-600">
          {result.warnings.map((warning, index) => (
            <li key={index}>⚠ {warning}</li>
          ))}
        </ul>
      )}

      {(copyText || result.result_latex) && (
        <div className="flex gap-2">
          <CopyButton text={copyText ?? null} label="Copiar resultado" />
          <CopyButton text={result.result_latex ?? null} label="Copiar como LaTeX" />
        </div>
      )}

      {result.has_detailed_steps && <StepList steps={result.steps} />}
    </div>
  );
}
