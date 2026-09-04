/**
 * src/components/fractionDisplay.ts
 *
 * Modo fracción propia/impropia (pedido explícito del usuario, ya
 * existía en Lite vía fractions.ts). Acá no hay una capa de fracciones
 * propia como en Lite — SymPy ya entrega el resultado exacto como LaTeX
 * (`result_latex`), así que en vez de reconstruir el cálculo desde cero,
 * se parsea el `\frac{n}{d}` que SymPy ya generó y se deriva la forma
 * mixta a partir de eso — nunca se fabrica una fracción desde un
 * decimal aproximado (mismo principio que `isFractionLatex` ya aplica
 * en ResultPanel.tsx).
 *
 * Formato de SymPy verificado contra el paquete real antes de escribir
 * el regex (no asumido):
 *   latex(Rational(57, 2))  -> "\frac{57}{2}"      (positivo, sin signo)
 *   latex(Rational(-57, 2)) -> "- \frac{57}{2}"     (negativo, CON ESPACIO
 *                                                     tras el signo)
 *   latex(Rational(4, 2))   -> "2"                  (SymPy ya simplifica
 *                                                     a entero — no llega
 *                                                     acá como \frac)
 */

export interface ParsedFraction {
  n: number;
  d: number;
}

const FRAC_LATEX_PATTERN = /^(-\s*)?\\frac\{(\d+)\}\{(\d+)\}$/;

/** Extrae numerador/denominator de un LaTeX `\frac{n}{d}` (con o sin
 * signo negativo al frente, con o sin el espacio que SymPy agrega tras
 * el "-"). `null` si no matchea ese patrón exacto. */
export function parseFracLatex(latex: string): ParsedFraction | null {
  const m = FRAC_LATEX_PATTERN.exec(latex.trim());
  if (!m) return null;
  const sign = m[1] ? -1 : 1;
  const d = Number(m[3]);
  if (d === 0) return null;
  return { n: sign * Number(m[2]), d };
}

/** Forma mixta de n/d, o `null` si la fracción ya es propia (|n| < d) —
 * en ese caso no hay una forma mixta distinta que mostrar, igual criterio
 * que `mixedLatex: null` en Lite (fractions.ts). */
export function toMixedFracLatex(n: number, d: number): string | null {
  const absN = Math.abs(n);
  if (absN < d) return null;
  const sign = n < 0 ? "-" : "";
  const whole = Math.trunc(absN / d);
  const remainder = absN % d;
  // Caso raro (SymPy normalmente ya simplifica n/d a un entero antes de
  // llegar acá si el resto es 0) — se cubre de todas formas por defensa.
  if (remainder === 0) return `${sign}${whole}`;
  return `${sign}${whole}\\frac{${remainder}}{${d}}`;
}
