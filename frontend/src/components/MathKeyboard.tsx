/**
 * src/components/MathKeyboard.tsx — teclado matemático virtual (spec,
 * sección 11): inserta texto ASCII en el campo enlazado (en la posición
 * del cursor cuando es posible), con debounce 300ms para la vista previa
 * KaTeX (best-effort, fallback a texto plano).
 *
 * Layout tipo calculadora científica (números + operadores fijos a la
 * derecha, funciones agrupadas por pestaña a la izquierda), inspirado en
 * calculadoras como la de Google o GeoGebra.
 */

import { useEffect, useState } from "react";

import { asciiToLatexBestEffort } from "./asciiToLatex";
import { MathRenderer } from "./MathRenderer";

interface KeyDef {
  label: string;
  insert: string;
  /** Cuántos caracteres retroceder el cursor tras insertar (p. ej. para quedar dentro de los paréntesis). */
  cursorOffset?: number;
}

const FUNCTION_TABS: { id: string; label: string; keys: KeyDef[] }[] = [
  {
    id: "basico",
    label: "Básico",
    keys: [
      { label: "x²", insert: "**2" },
      { label: "xʸ", insert: "**" },
      { label: "√", insert: "sqrt()", cursorOffset: 1 },
      { label: "|x|", insert: "abs()", cursorOffset: 1 },
      { label: "π", insert: "pi" },
      { label: "e", insert: "e" },
      { label: "∞", insert: "oo" },
      { label: "i", insert: "i" },
    ],
  },
  {
    id: "funciones",
    label: "Funciones",
    keys: [
      { label: "sin", insert: "sin()", cursorOffset: 1 },
      { label: "cos", insert: "cos()", cursorOffset: 1 },
      { label: "tan", insert: "tan()", cursorOffset: 1 },
      { label: "log", insert: "log()", cursorOffset: 1 },
      { label: "ln", insert: "ln()", cursorOffset: 1 },
      { label: "exp", insert: "exp()", cursorOffset: 1 },
      { label: "(", insert: "(" },
      { label: ")", insert: ")" },
    ],
  },
];

const NUMPAD: KeyDef[][] = [
  [{ label: "7", insert: "7" }, { label: "8", insert: "8" }, { label: "9", insert: "9" }, { label: "÷", insert: "/" }],
  [{ label: "4", insert: "4" }, { label: "5", insert: "5" }, { label: "6", insert: "6" }, { label: "×", insert: "*" }],
  [{ label: "1", insert: "1" }, { label: "2", insert: "2" }, { label: "3", insert: "3" }, { label: "−", insert: "-" }],
  [{ label: "0", insert: "0" }, { label: ".", insert: "." }, { label: ",", insert: "," }, { label: "+", insert: "+" }],
];

const PREVIEW_DEBOUNCE_MS = 300;

interface MathKeyboardProps {
  value: string;
  onChange: (next: string) => void;
  inputId?: string;
  onSubmit?: () => void;
}

export function MathKeyboard({ value, onChange, inputId, onSubmit }: MathKeyboardProps) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const [activeTab, setActiveTab] = useState(FUNCTION_TABS[0].id);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value]);

  function getInputEl(): HTMLInputElement | null {
    if (!inputId) return null;
    return document.getElementById(inputId) as HTMLInputElement | null;
  }

  function insertText(snippet: string, cursorOffset = 0): void {
    const el = getInputEl();
    const caret = el?.selectionStart ?? value.length;
    const caretEnd = el?.selectionEnd ?? value.length;
    const next = value.slice(0, caret) + snippet + value.slice(caretEnd);
    onChange(next);

    const nextCaret = caret + snippet.length - cursorOffset;
    requestAnimationFrame(() => {
      const target = getInputEl();
      target?.focus();
      target?.setSelectionRange(nextCaret, nextCaret);
    });
  }

  function backspace(): void {
    const el = getInputEl();
    const caret = el?.selectionStart ?? value.length;
    const caretEnd = el?.selectionEnd ?? value.length;
    if (caret === caretEnd && caret > 0) {
      onChange(value.slice(0, caret - 1) + value.slice(caret));
      requestAnimationFrame(() => {
        const target = getInputEl();
        target?.focus();
        target?.setSelectionRange(caret - 1, caret - 1);
      });
    } else if (caret !== caretEnd) {
      onChange(value.slice(0, caret) + value.slice(caretEnd));
      requestAnimationFrame(() => {
        const target = getInputEl();
        target?.focus();
        target?.setSelectionRange(caret, caret);
      });
    } else {
      onChange(value.slice(0, -1));
    }
  }

  function clearAll(): void {
    onChange("");
    getInputEl()?.focus();
  }

  const previewLatex = asciiToLatexBestEffort(debouncedValue);
  const activeKeys = FUNCTION_TABS.find((tab) => tab.id === activeTab)?.keys ?? [];

  const keyBase =
    "flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500";
  const funcKeyClass = `${keyBase} h-9 border border-stone-200 bg-white text-stone-700 hover:bg-stone-50`;
  const numKeyClass = `${keyBase} h-9 bg-stone-100 text-stone-900 hover:bg-stone-200`;
  const opKeyClass = `${keyBase} h-9 border border-stone-200 bg-white text-blue-600 hover:bg-stone-50`;

  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex gap-1" role="tablist" aria-label="Grupos de funciones">
          {FUNCTION_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded px-2.5 py-1 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white"
                  : "text-stone-500 hover:bg-stone-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={clearAll}
          className="text-xs font-medium text-stone-400 hover:text-stone-600"
        >
          Borrar todo
        </button>
      </div>

      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
        <div className="col-span-4 grid grid-cols-4 gap-1.5">
          {activeKeys.map((key) => (
            <button
              key={key.label}
              type="button"
              onClick={() => insertText(key.insert, key.cursorOffset)}
              aria-label={`Insertar ${key.label}`}
              className={funcKeyClass}
            >
              {key.label}
            </button>
          ))}
        </div>

        <div className="col-span-4 grid grid-cols-4 gap-1.5">
          {NUMPAD.flat().map((key, index) => (
            <button
              key={`${key.label}-${index}`}
              type="button"
              onClick={() => insertText(key.insert)}
              aria-label={key.label === "÷" || key.label === "×" || key.label === "−" ? `Operador ${key.label}` : key.label}
              className={/[0-9.,]/.test(key.label) ? numKeyClass : opKeyClass}
            >
              {key.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-1.5 grid grid-cols-4 gap-1.5 sm:grid-cols-8">
        <button
          type="button"
          onClick={backspace}
          aria-label="Borrar último carácter"
          className={`${keyBase} col-span-2 h-9 bg-stone-800 text-white hover:bg-stone-700 sm:col-span-4`}
        >
          ⌫
        </button>
        <button
          type="button"
          onClick={() => onSubmit?.()}
          aria-label="Calcular"
          className={`${keyBase} col-span-2 h-9 bg-blue-600 text-white hover:bg-blue-500 sm:col-span-4`}
        >
          =
        </button>
      </div>

      {debouncedValue.trim() !== "" && (
        <div className="mt-3 border-t border-stone-200 pt-2">
          <span className="text-xs text-stone-400">Vista previa (aproximada)</span>
          <div aria-live="polite" className="mt-1 text-stone-900">
            <MathRenderer latex={previewLatex} fallbackText={debouncedValue} />
          </div>
        </div>
      )}
    </div>
  );
}
