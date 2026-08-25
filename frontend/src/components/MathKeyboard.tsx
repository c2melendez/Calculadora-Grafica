/**
 * src/components/MathKeyboard.tsx — teclado matemático virtual.
 * Mismo patrón visual que Precision Lab Lite (capas SHIFT/ALPHA "de un solo
 * disparo", tokens chrome/marker/alpha/graph), adaptado a la API existente:
 * inserta sintaxis ASCII (sqrt(), **2, etc.) en el input enlazado por
 * `inputId`, con debounce 300ms para la vista previa KaTeX. La lógica de
 * inserción/caret (insertText, backspace, clearAll) no cambió — solo el
 * layout de teclas y su estilo.
 */

import { useEffect, useState } from "react";

import { asciiToLatexBestEffort } from "./asciiToLatex";
import { MathRenderer } from "./MathRenderer";

interface KeyDef {
  label: string;
  insert: string;
  cursorOffset?: number;
  shiftLabel?: string;
  shiftInsert?: string;
  shiftCursorOffset?: number;
  alphaLabel?: string;
  alphaInsert?: string;
}

const STRUCT_KEYS: KeyDef[] = [
  { label: "(", insert: "(", alphaLabel: "|x|", alphaInsert: "abs()" },
  { label: ")", insert: ")", alphaLabel: "i", alphaInsert: "i" },
  { label: "x²", insert: "**2", shiftLabel: "√", shiftInsert: "sqrt()", shiftCursorOffset: 1 },
  { label: "xʸ", insert: "**" },
  { label: "π", insert: "pi", shiftLabel: "e", shiftInsert: "e" },
];

const TRIG_KEYS: KeyDef[] = [
  { label: "sin", insert: "sin()", cursorOffset: 1, shiftLabel: "sin⁻¹", shiftInsert: "asin()", shiftCursorOffset: 1, alphaLabel: "x", alphaInsert: "x" },
  { label: "cos", insert: "cos()", cursorOffset: 1, shiftLabel: "cos⁻¹", shiftInsert: "acos()", shiftCursorOffset: 1, alphaLabel: "y", alphaInsert: "y" },
  { label: "tan", insert: "tan()", cursorOffset: 1, shiftLabel: "tan⁻¹", shiftInsert: "atan()", shiftCursorOffset: 1, alphaLabel: "z", alphaInsert: "z" },
  { label: "ln", insert: "ln()", cursorOffset: 1, shiftLabel: "eˣ", shiftInsert: "exp()", shiftCursorOffset: 1, alphaLabel: "n", alphaInsert: "n" },
  { label: "log", insert: "log()", cursorOffset: 1, shiftLabel: "∞", shiftInsert: "oo", alphaLabel: "t", alphaInsert: "t" },
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
  const [modifier, setModifier] = useState<"shift" | "alpha" | null>(null);

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

  function moveCaret(delta: number): void {
    const el = getInputEl();
    const caret = (el?.selectionStart ?? value.length) + delta;
    requestAnimationFrame(() => {
      const target = getInputEl();
      target?.focus();
      target?.setSelectionRange(caret, caret);
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

  function press(key: KeyDef) {
    if (modifier === "shift" && key.shiftInsert) insertText(key.shiftInsert, key.shiftCursorOffset ?? 0);
    else if (modifier === "alpha" && key.alphaInsert) insertText(key.alphaInsert);
    else insertText(key.insert, key.cursorOffset ?? 0);
    setModifier(null);
  }

  function toggleModifier(m: "shift" | "alpha") {
    setModifier((cur) => (cur === m ? null : m));
  }

  const previewLatex = asciiToLatexBestEffort(debouncedValue);

  return (
    <div className="rounded-lg bg-chrome p-3">
      {/* Fila de control: SHIFT / ALPHA / navegación / borrar todo */}
      <div className="mb-1.5 grid grid-cols-5 gap-1.5">
        <ModKey label="SHIFT" active={modifier === "shift"} tone="marker" onClick={() => toggleModifier("shift")} />
        <ModKey label="ALPHA" active={modifier === "alpha"} tone="alpha" onClick={() => toggleModifier("alpha")} />
        <Key label="←" onClick={() => moveCaret(-1)} />
        <Key label="→" onClick={() => moveCaret(1)} />
        <Key label="AC" tone="marker" onClick={clearAll} />
      </div>

      <KeyRow keys={STRUCT_KEYS} modifier={modifier} onPress={press} />
      <KeyRow keys={TRIG_KEYS} modifier={modifier} onPress={press} />

      <div className="grid grid-cols-4 gap-1.5">
        {NUMPAD.flat().map((key, index) => (
          <button
            key={`${key.label}-${index}`}
            type="button"
            onClick={() => insertText(key.insert)}
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

      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={backspace}
          aria-label="Borrar último carácter"
          className="rounded-md bg-chrome-soft py-2 text-sm font-medium text-bone hover:bg-chrome-soft/70"
        >
          ⌫
        </button>
        <button
          type="button"
          onClick={() => onSubmit?.()}
          aria-label="Calcular"
          className="rounded-md bg-graph py-2 text-base font-semibold text-paper hover:bg-graph/90"
        >
          =
        </button>
      </div>

      {debouncedValue.trim() !== "" && (
        <div className="mt-3 rounded-md border border-paper-line bg-paper p-2">
          <span className="text-xs text-muted">Vista previa (aproximada)</span>
          <div aria-live="polite" className="mt-1 text-ink">
            <MathRenderer latex={previewLatex} fallbackText={debouncedValue} />
          </div>
        </div>
      )}
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

function Key({ label, onClick, tone }: { label: string; onClick: () => void; tone?: "marker" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-md bg-chrome-soft py-2 text-sm font-medium hover:bg-chrome-soft/70 ${
        tone === "marker" ? "text-marker" : "text-bone"
      }`}
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
