/**
 * src/components/systemSplit.ts
 *
 * Fase 1 (fusión de modos, plan de 3 fases — mismo patrón ya aplicado en
 * Precision Lab Lite vía engine/parsing/systemSplit.ts): detecta si el
 * LaTeX del campo único de BasicMode contiene un entorno
 * \begin{cases}...\end{cases} — el que inserta el ícono de sistema del
 * teclado — y lo separa en ecuaciones individuales, una por renglón, en
 * LaTeX (todavía sin convertir a sintaxis ASCII del backend; eso lo hace
 * el llamador con `latexToBackendSyntax`, igual que con la expresión
 * simple).
 *
 * A diferencia de Lite, acá no hay ningún parser propio en el cliente —
 * todo el cómputo (incluida la inferencia de variables para una sola
 * ecuación vía /solve) vive en el backend. Por eso este helper solo
 * separa renglones; NO intenta extraer variables libres del ASCII
 * resultante — el backend no infiere variables para sistemas
 * (`SystemRequest.variables` es obligatorio, min 2, en
 * `backend/app/schemas/requests.py`), así que BasicMode.tsx le pide la
 * lista al usuario en un campo chico que aparece solo cuando se detecta
 * un sistema, en vez de adivinarla con una heurística propia en el
 * cliente que podría equivocarse silenciosamente.
 */

const CASES_PATTERN = /\\begin\{cases\}([\s\S]*?)\\end\{cases\}/;

/**
 * Devuelve las ecuaciones de un entorno `cases` como LaTeX individual por
 * renglón, o `null` si `latex` no contiene ese entorno (o contiene menos
 * de 2 renglones no vacíos, que no alcanza para un sistema).
 */
export function splitSystemLatex(latex: string): string[] | null {
  const match = CASES_PATTERN.exec(latex);
  if (!match) return null;

  const rows = match[1]
    .split("\\\\")
    .map((row) => row.trim())
    .filter((row) => row.length > 0);

  return rows.length >= 2 ? rows : null;
}
