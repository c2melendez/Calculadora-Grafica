/**
 * src/components/NaturalMathKeyboard.tsx — teclado para NaturalMathField:
 * inserta LaTeX (no texto ASCII) vía `MathfieldElement.insert()`. Las
 * plantillas usan `#0`/`#1` como marcadores de posición — MathLive mueve
 * el cursor automáticamente ahí (igual que el botón √ o sin() en
 * GeoGebra/Google: crean la "caja" vacía lista para escribir dentro).
 *
 * Mismo patrón visual que el resto de Precision Lab: capas SHIFT/ALPHA de
 * un solo disparo (tokens chrome/marker/alpha), en vez de las pestañas
 * Básico/Funciones anteriores.
 */

import type { MathfieldElement } from "mathlive";
import { useState } from "react";

interface KeyDef {
  label: string;
  latex: string;
  shiftLabel?: string;
  shiftLatex?: string;
  alphaLabel?: string;
  alphaLatex?: string;
}

const STRUCT_KEYS: KeyDef[] = [
  { label: "(", latex: "(", alphaLabel: "|x|", alphaLatex: "\\left|#0\\right|" },
  { label: ")", latex: ")", alphaLabel: "i", alphaLatex: "i" },
  { label: "x²", latex: "^{2}", shiftLabel: "√", shiftLatex: "\\sqrt{#0}" },
  { label: "xʸ", latex: "^{#0}", shiftLabel: "ⁿ√", shiftLatex: "\\sqrt[#0]{#1}" },
  { label: "π", latex: "\\pi", shiftLabel: "e", shiftLatex: "e" },
];

const TRIG_KEYS: KeyDef[] = [
  { label: "sin", latex: "\\sin\\left(#0\\right)", shiftLabel: "sin⁻¹", shiftLatex: "\\sin^{-1}\\left(#0\\right)", alphaLabel: "x", alphaLatex: "x" },
  { label: "cos", latex: "\\cos\\left(#0\\right)", shiftLabel: "cos⁻¹", shiftLatex: "\\cos^{-1}\\left(#0\\right)", alphaLabel: "y", alphaLatex: "y" },
  { label: "tan", latex: "\\tan\\left(#0\\right)", shiftLabel: "tan⁻¹", shiftLatex: "\\tan^{-1}\\left(#0\\right)", alphaLabel: "z", alphaLatex: "z" },
  { label: "ln", latex: "\\ln\\left(#0\\right)", shiftLabel: "eˣ", shiftLatex: "e^{#0}", alphaLabel: "n", alphaLatex: "n" },
  { label: "log", latex: "\\log\\left(#0\\right)", shiftLabel: "∞", shiftLatex: "\\infty", alphaLabel: "t", alphaLatex: "t" },
];

const NUMPAD: KeyDef[][] = [
  [{ label: "7", latex: "7" }, { label: "8", latex: "8" }, { label: "9", latex: "9" }, { label: "÷", latex: "/" }],
  [{ label: "4", latex: "4" }, { label: "5", latex: "5" }, { label: "6", latex: "6" }, { label: "×", latex: "\\times" }],
  [{ label: "1", latex: "1" }, { label: "2", latex: "2" }, { label: "3", latex: "3" }, { label: "−", latex: "-" }],
  [{ label: "0", latex: "0" }, { label: ".", latex: "." }, { label: "=", latex: "=" }, { label: "+", latex: "+" }],
];

interface NaturalMathKeyboardProps {
  field: MathfieldElement | null;
  onSubmit?: () => void;
}

export function NaturalMathKeyboard({ field, onSubmit }: NaturalMathKeyboardProps) {
  const [modifier, setModifier] = useState<"shift" | "alpha" | null>(null);

  function press(key: KeyDef): void {
    const latex =
      modifier === "shift" && key.shiftLatex
        ? key.shiftLatex
        : modifier === "alpha" && key.alphaLatex
          ? key.alphaLatex
          : key.latex;
    field?.focus();
    field?.insert(latex);
    setModifier(null);
  }

  function toggleModifier(m: "shift" | "alpha"): void {
    setModifier((cur) => (cur === m ? null : m));
  }

  function backspace(): void {
    field?.focus();
    field?.executeCommand("deleteBackward");
  }

  function clearAll(): void {
    field?.focus();
    field?.setValue("");
  }

  return (
    <div className="rounded-lg bg-chrome p-3">
      <div className="mb-1.5 grid grid-cols-5 gap-1.5">
        <ModKey label="SHIFT" active={modifier === "shift"} tone="marker" onClick={() => toggleModifier("shift")} />
        <ModKey label="ALPHA" active={modifier === "alpha"} tone="alpha" onClick={() => toggleModifier("alpha")} />
        <Key label="⌫" onClick={backspace} />
        <Key label="AC" tone="marker" onClick={clearAll} />
        <Key label="=" tone="graph" onClick={() => onSubmit?.()} />
      </div>

      <KeyRow keys={STRUCT_KEYS} modifier={modifier} onPress={press} />
      <KeyRow keys={TRIG_KEYS} modifier={modifier} onPress={press} />

      <div className="grid grid-cols-4 gap-1.5">
        {NUMPAD.flat().map((key, index) => (
          <button
            key={`${key.label}-${index}`}
            type="button"
            onClick={() => press(key)}
            aria-label={key.label === "÷" || key.label === "×" || key.label === "−" ? `Operador ${key.label}` : key.label}
            className={
              /[0-9.,]/.test(key.label)
                ? "rounded-md bg-chrome-soft/80 py-2 text-base font-medium text-bone hover:bg-chrome-soft/60"
                : "rounded-md bg-chrome-soft py-2 text-sm font-medium text-graph hover:bg-chrome-soft/70"
            }
          >
            {key.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function KeyRow({
  keys,
  modifier,
  onPress,
}: {
  keys: KeyDef[];
  modifier: "shift" | "alpha" | null;
  onPress: (key: KeyDef) => void;
}) {
  return (
    <div className="mb-1.5 grid grid-cols-5 gap-1.5">
      {keys.map((k) => {
        const subLabel = modifier === "shift" ? k.shiftLabel : modifier === "alpha" ? k.alphaLabel : undefined;
        return (
          <div key={k.label} className="text-center">
            <div
              className={`mb-0.5 h-2.5 text-[8px] leading-none ${
                subLabel ? (modifier === "shift" ? "text-marker" : "text-alpha") : "text-transparent"
              }`}
            >
              {subLabel ?? "·"}
            </div>
            <button
              type="button"
              onClick={() => onPress(k)}
              aria-label={`Insertar ${k.label}`}
              className="w-full rounded-md bg-chrome-soft py-2 text-sm text-bone hover:bg-chrome-soft/70"
            >
              {k.label}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function Key({ label, onClick, tone }: { label: string; onClick: () => void; tone?: "marker" | "graph" }) {
  const toneClass = tone === "marker" ? "text-marker" : tone === "graph" ? "text-graph" : "text-bone";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-md bg-chrome-soft py-2 text-sm font-medium hover:bg-chrome-soft/70 ${toneClass}`}
    >
      {label}
    </button>
  );
}

function ModKey({
  label,
  active,
  tone,
  onClick,
}: {
  label: string;
  active: boolean;
  tone: "marker" | "alpha";
  onClick: () => void;
}) {
  const toneMap = {
    marker: { bg: "bg-marker-soft", text: "text-marker-text", idle: "text-marker" },
    alpha: { bg: "bg-alpha-soft", text: "text-alpha", idle: "text-alpha" },
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-md py-2 text-[11px] font-semibold ${
        active ? `${toneMap.bg} ${toneMap.text}` : `bg-chrome-soft ${toneMap.idle}`
      }`}
    >
      {label}
    </button>
  );
}
