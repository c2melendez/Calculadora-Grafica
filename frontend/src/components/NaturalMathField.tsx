/**
 * src/components/NaturalMathField.tsx — campo de entrada matemática
 * "natural" (fracciones, raíces y exponentes se ven mientras se escriben,
 * como en GeoGebra/Desmos), envolviendo el <math-field> de MathLive.
 *
 * MathLive nunca se muestra al backend: internamente guarda LaTeX, y este
 * componente lo convierte a la sintaxis ASCII que `parsing.py` espera
 * (implicit_multiplication_application + convert_xor, sección 5) antes de
 * llamarlo. Ver `latexToBackendSyntax` para los ajustes puntuales sobre lo
 * que produce `convertLatexToAsciiMath` por defecto.
 */

import "mathlive";
import { convertLatexToAsciiMath } from "mathlive/ssr";
import { useEffect, useId, useRef } from "react";
import type { MathfieldElement, MathfieldElementAttributes } from "mathlive";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "math-field": React.DetailedHTMLProps<
        React.HTMLAttributes<MathfieldElement> & Partial<MathfieldElementAttributes>,
        MathfieldElement
      >;
    }
  }
}

/**
 * `convertLatexToAsciiMath` deja `root(n)(x)` para `\sqrt[n]{x}`, pero el
 * backend no tiene una función `root` (solo `sqrt`, ver
 * `matrix_service`/`parsing.py`) — se reescribe como `(x)**(1/(n))`, que
 * SÍ entiende (`convert_xor`/`**` ambos soportados).
 */
function rewriteNthRoot(ascii: string): string {
  const pattern = /root\(([^()]+)\)\(([^()]+)\)/g;
  let result = ascii;
  // Se repite porque una raíz puede anidar otra en el índice o el radicando.
  for (let i = 0; i < 5 && pattern.test(result); i++) {
    pattern.lastIndex = 0;
    result = result.replace(pattern, (_match, n: string, x: string) => `(${x})**(1/(${n}))`);
  }
  return result;
}

export function latexToBackendSyntax(latex: string): string {
  if (latex.trim() === "") return "";
  const ascii = convertLatexToAsciiMath(latex);
  return rewriteNthRoot(ascii).trim();
}

interface NaturalMathFieldProps {
  latex: string;
  onLatexChange: (latex: string) => void;
  ariaLabel: string;
  placeholder?: string;
  fieldRef?: (el: MathfieldElement | null) => void;
}

export function NaturalMathField({
  latex,
  onLatexChange,
  ariaLabel,
  placeholder,
  fieldRef,
}: NaturalMathFieldProps) {
  const elRef = useRef<MathfieldElement | null>(null);
  const fieldId = useId();

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    function handleInput(): void {
      if (el && el.getValue("latex-unstyled") !== latex) {
        onLatexChange(el.getValue("latex-unstyled"));
      }
    }

    el.addEventListener("input", handleInput);
    return () => el.removeEventListener("input", handleInput);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onLatexChange]);

  useEffect(() => {
    const el = elRef.current;
    if (el && el.getValue("latex-unstyled") !== latex) {
      el.setValue(latex);
    }
  }, [latex]);

  return (
    <math-field
      id={fieldId}
      ref={(el: MathfieldElement | null) => {
        elRef.current = el;
        fieldRef?.(el);
      }}
      math-virtual-keyboard-policy="manual"
      aria-label={ariaLabel}
      placeholder={placeholder}
      style={{
        display: "block",
        width: "100%",
        borderRadius: "9999px",
        border: "1px solid #d6d3d1",
        backgroundColor: "white",
        padding: "0.65rem 3.25rem 0.65rem 1.25rem",
        fontSize: "1.05rem",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
    />
  );
}
