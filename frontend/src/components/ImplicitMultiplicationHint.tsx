/**
 * src/components/ImplicitMultiplicationHint.tsx — ayuda visible sobre la
 * convención de multiplicación implícita (spec, sección 3 y 11: TODOS los
 * modos deben mostrarla junto al campo de expresión).
 */

export function ImplicitMultiplicationHint() {
  return (
    <p className="text-xs text-slate-400" role="note">
      Usa <code className="rounded bg-slate-800 px-1 py-0.5">x*y</code>, no{" "}
      <code className="rounded bg-slate-800 px-1 py-0.5">xy</code> — los identificadores de varias
      letras (como <code className="rounded bg-slate-800 px-1 py-0.5">theta</code>) se interpretan
      como un único nombre de variable, no como una multiplicación.
    </p>
  );
}
