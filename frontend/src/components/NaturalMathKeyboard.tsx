/**
 * src/components/NaturalMathKeyboard.tsx — teclado para NaturalMathField:
 * inserta LaTeX (no texto ASCII) vía `MathfieldElement.insert()`. Las
 * plantillas usan `#0`/`#1` como marcadores de posición — MathLive mueve
 * el cursor automáticamente ahí (igual que el botón √ o sin() en
 * GeoGebra/Google: crean la "caja" vacía lista para escribir dentro).
 */

import type { MathfieldElement } from "mathlive";
import { useState } from "react";

interface KeyDef {
  label: string;
  latex: string;
}

const FUNCTION_TABS: { id: string; label: string; keys: KeyDef[] }[] = [
  {
    id: "basico",
    label: "Básico",
    keys: [
      { label: "x²", latex: "^{2}" },
      { label: "xʸ", latex: "^{#0}" },
      { label: "√", latex: "\\sqrt{#0}" },
      { label: "|x|", latex: "\\left|#0\\right|" },
      { label: "π", latex: "\\pi" },
      { label: "e", latex: "e" },
      { label: "∞", latex: "\\infty" },
      { label: "i", latex: "i" },
    ],
  },
  {
    id: "funciones",
    label: "Funciones",
    keys: [
      { label: "sin", latex: "\\sin\\left(#0\\right)" },
      { label: "cos", latex: "\\cos\\left(#0\\right)" },
      { label: "tan", latex: "\\tan\\left(#0\\right)" },
      { label: "log", latex: "\\log\\left(#0\\right)" },
      { label: "ln", latex: "\\ln\\left(#0\\right)" },
      { label: "exp", latex: "e^{#0}" },
      { label: "(", latex: "(" },
      { label: ")", latex: ")" },
    ],
  },
];

const NUMPAD: KeyDef[][] = [
  [
    { label: "7", latex: "7" },
    { label: "8", latex: "8" },
    { label: "9", latex: "9" },
    { label: "÷", latex: "/" },
  ],
  [
    { label: "4", latex: "4" },
    { label: "5", latex: "5" },
    { label: "6", latex: "6" },
    { label: "×", latex: "\\times" },
  ],
  [
    { label: "1", latex: "1" },
    { label: "2", latex: "2" },
    { label: "3", latex: "3" },
    { label: "−", latex: "-" },
  ],
  [
    { label: "0", latex: "0" },
    { label: ".", latex: "." },
    { label: "=", latex: "=" },
    { label: "+", latex: "+" },
  ],
];

interface NaturalMathKeyboardProps {
  field: MathfieldElement | null;
  onSubmit?: () => void;
}

export function NaturalMathKeyboard({ field, onSubmit }: NaturalMathKeyboardProps) {
  const [activeTab, setActiveTab] = useState(FUNCTION_TABS[0].id);
  const activeKeys = FUNCTION_TABS.find((tab) => tab.id === activeTab)?.keys ?? [];

  function press(latex: string): void {
    field?.focus();
    field?.insert(latex);
  }

  function backspace(): void {
    field?.focus();
    field?.executeCommand("deleteBackward");
  }

  function clearAll(): void {
    field?.focus();
    field?.setValue("");
  }

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
                activeTab === tab.id ? "bg-blue-600 text-white" : "text-stone-500 hover:bg-stone-100"
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
              onClick={() => press(key.latex)}
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
              onClick={() => press(key.latex)}
              aria-label={
                key.label === "÷" || key.label === "×" || key.label === "−" || key.label === "="
                  ? `Operador ${key.label}`
                  : key.label
              }
              className={/[0-9.]/.test(key.label) ? numKeyClass : opKeyClass}
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
    </div>
  );
}
