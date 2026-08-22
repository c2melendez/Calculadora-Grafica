/**
 * src/components/asciiToLatex.ts — conversión LOCAL best-effort de texto
 * ASCII (la sintaxis que el backend realmente parsea, sección 3) a LaTeX
 * para la vista previa de `MathKeyboard` (spec, sección 11: "no un parser
 * LaTeX completo; fallback a texto plano si la conversión local no es
 * válida"). Esto NO es el parser de verdad — el backend es la única
 * fuente de verdad matemática; esto es solo una vista previa aproximada.
 */

export function asciiToLatexBestEffort(input: string): string {
  let result = input;
  result = result.replace(/\*\*/g, "^");
  result = result.replace(/sqrt\(([^()]*)\)/g, "\\sqrt{$1}");
  result = result.replace(/\bpi\b/g, "\\pi");
  result = result.replace(/\boo\b/g, "\\infty");
  result = result.replace(/\*/g, "\\cdot ");
  for (const fn of ["sin", "cos", "tan", "asin", "acos", "atan", "log", "ln", "exp"]) {
    result = result.replace(new RegExp(`\\b${fn}\\(`, "g"), `\\${fn}(`);
  }
  return result;
}
