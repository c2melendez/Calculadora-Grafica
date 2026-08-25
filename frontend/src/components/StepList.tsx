/**
 * src/components/StepList.tsx — procedimiento paso a paso.
 * Mismo lenguaje visual que Precision Lab Lite (ficha tipo "margen de
 * cuaderno"), aprovechando aquí el modelo de datos completo (title, rule,
 * latex_before/after) que expone el backend SymPy. Ver auditoría Fase 0.
 */

import type { components } from "../types/api";
import { MathRenderer } from "./MathRenderer";

type Step = components["schemas"]["Step"];

interface StepListProps {
  steps: Step[];
  activeIndex?: number;
}

export function StepList({ steps, activeIndex }: StepListProps) {
  if (steps.length === 0) return null;

  return (
    <ol className="relative flex flex-col gap-3.5 pl-5" aria-label="Procedimiento paso a paso">
      <div className="absolute bottom-1 left-[9px] top-1 w-px bg-paper-line" aria-hidden="true" />

      {steps.map((step, i) => {
        const isActive = activeIndex === i;
        return (
          <li key={step.index} className="relative fade-in">
            <span
              className={
                isActive
                  ? "absolute -left-5 top-0.5 h-3 w-3 rounded-full bg-marker ring-4 ring-marker-soft"
                  : "absolute -left-5 top-0.5 h-3 w-3 rounded-full border-2 border-paper-line bg-paper"
              }
              aria-hidden="true"
            />
            <div className={isActive ? "-mx-2.5 rounded-lg border-l-[3px] border-marker bg-marker-soft p-2.5" : ""}>
              <div className="flex items-center justify-between">
                <span className={isActive ? "text-sm font-medium text-marker-text" : "text-sm font-medium text-muted"}>
                  {step.title}
                </span>
                {step.rule && (
                  <span className="rounded bg-paper-soft px-2 py-0.5 font-mono text-xs text-muted">
                    {step.rule}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted">{step.description}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <MathRenderer latex={step.latex_before} className="text-muted" />
                <span className="text-muted">→</span>
                <MathRenderer latex={step.latex_after} className="text-ink" />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
