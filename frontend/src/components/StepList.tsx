/**
 * src/components/StepList.tsx — procedimiento paso a paso (spec, sección
 * 4/8/11): renderiza `MathResponse.steps`.
 */

import type { components } from "../types/api";
import { MathRenderer } from "./MathRenderer";

type Step = components["schemas"]["Step"];

interface StepListProps {
  steps: Step[];
}

export function StepList({ steps }: StepListProps) {
  if (steps.length === 0) return null;

  return (
    <ol className="space-y-3" aria-label="Procedimiento paso a paso">
      {steps.map((step) => (
        <li
          key={step.index}
          className="rounded border border-stone-200 bg-stone-50 p-3 fade-in"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-stone-800">{step.title}</span>
            {step.rule && (
              <span className="rounded bg-stone-100 px-2 py-0.5 text-xs text-stone-400">
                {step.rule}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-stone-400">{step.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <MathRenderer latex={step.latex_before} className="text-stone-600" />
            <span className="text-stone-500">→</span>
            <MathRenderer latex={step.latex_after} className="text-stone-900" />
          </div>
        </li>
      ))}
    </ol>
  );
}
