/**
 * src/components/MathKeyboard.tsx — teclado matemático virtual (spec,
 * sección 11): inserta texto ASCII en el campo enlazado, con debounce
 * 300ms para la vista previa KaTeX (best-effort, fallback a texto plano).
 */

import { useEffect, useState } from "react";

import { asciiToLatexBestEffort } from "./asciiToLatex";
import { MathRenderer } from "./MathRenderer";

const KEY_GROUPS: { label: string; keys: { label: string; insert: string }[] }[] = [
  {
    label: "Básico",
    keys: [
      { label: "π", insert: "pi" },
      { label: "√", insert: "sqrt()" },
      { label: "^", insert: "**" },
      { label: "( )", insert: "()" },
      { label: "∞", insert: "oo" },
    ],
  },
  {
    label: "Funciones",
    keys: [
      { label: "sin", insert: "sin()" },
      { label: "cos", insert: "cos()" },
      { label: "tan", insert: "tan()" },
      { label: "log", insert: "log()" },
      { label: "ln", insert: "ln()" },
    ],
  },
];

const PREVIEW_DEBOUNCE_MS = 300;

interface MathKeyboardProps {
  value: string;
  onChange: (next: string) => void;
  inputId?: string;
}

export function MathKeyboard({ value, onChange, inputId }: MathKeyboardProps) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value]);

  function insertText(snippet: string): void {
    onChange(value + snippet);
    if (inputId) {
      document.getElementById(inputId)?.focus();
    }
  }

  const previewLatex = asciiToLatexBestEffort(debouncedValue);

  return (
    <div className="space-y-2 rounded border border-slate-800 bg-slate-900/40 p-3">
      {KEY_GROUPS.map((group) => (
        <div key={group.label} className="space-y-1">
          <span className="text-xs text-slate-500">{group.label}</span>
          <div className="flex flex-wrap gap-1">
            {group.keys.map((key) => (
              <button
                key={key.label}
                type="button"
                onClick={() => insertText(key.insert)}
                aria-label={`Insertar ${key.label}`}
                className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm hover:bg-slate-700"
              >
                {key.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      {debouncedValue.trim() !== "" && (
        <div className="border-t border-slate-800 pt-2">
          <span className="text-xs text-slate-500">Vista previa (aproximada)</span>
          <div aria-live="polite" className="mt-1 text-slate-100">
            <MathRenderer latex={previewLatex} fallbackText={debouncedValue} />
          </div>
        </div>
      )}
    </div>
  );
}
