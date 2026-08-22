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

import type { MathResponse } from "../api/client";
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
      className="rounded border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {justCopied ? "¡Copiado!" : label}
    </button>
  );
}

export function ResultPanel({ result, isLoading }: ResultPanelProps) {
  if (isLoading) {
    return (
      <div role="status" aria-live="polite" className="text-sm text-slate-400">
        Calculando…
      </div>
    );
  }

  if (result === null) {
    return (
      <p className="text-sm text-slate-500">
        Introduce una expresión y envía el formulario para ver el resultado aquí.
      </p>
    );
  }

  if (!result.success) {
    return (
      <div role="alert" aria-live="assertive" className="text-sm text-red-300">
        <p className="font-medium">{result.error_code}</p>
        <p>{result.error_message}</p>
      </div>
    );
  }

  const displayText =
    result.result_approx != null ? formatResultApprox(result.result_approx) : result.result_text;

  return (
    <div aria-live="polite" className="space-y-4 fade-in">
      <div>
        {result.result_latex ? (
          <MathRenderer
            latex={result.result_latex}
            fallbackText={displayText ?? undefined}
            className="text-lg"
          />
        ) : (
          <p className="text-lg text-slate-100">{displayText}</p>
        )}
      </div>

      {!result.has_detailed_steps && (
        <p className="text-xs text-amber-400">Procedimiento resumido (sin desglose paso a paso).</p>
      )}

      {result.warnings.length > 0 && (
        <ul className="space-y-1 text-xs text-amber-300">
          {result.warnings.map((warning, index) => (
            <li key={index}>⚠ {warning}</li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <CopyButton text={displayText ?? null} label="Copiar resultado" />
        <CopyButton text={result.result_latex ?? null} label="Copiar como LaTeX" />
      </div>

      {result.has_detailed_steps && <StepList steps={result.steps} />}
    </div>
  );
}
