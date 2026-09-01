/**
 * src/components/BasicMode.tsx — modo Básico (spec, sección 11): campo de
 * expresión + `substitutions` (pares nombre/valor) + `angle_unit`,
 * conectado a `POST /evaluate`.
 *
 * Fase 1 (fusión de modos, plan de 3 fases — mismo patrón ya aplicado en
 * Precision Lab Lite): handleSubmit pasa de mandar SIEMPRE a /evaluate a
 * ser un router de 3 ramas, reusando tal cual la lógica de payload que ya
 * existe en EquationMode.tsx y SystemMode.tsx (esos dos componentes NO se
 * tocan ni se eliminan — siguen existiendo como pestañas aparte para
 * casos que este router no cubre, ej. sistemas de más de 6 ecuaciones).
 *   1. Si el campo tiene un entorno \begin{cases} (lo inserta el ícono de
 *      sistema del teclado) -> POST /solve/system. A diferencia de Lite,
 *      acá no hay parser propio en el cliente para inferir variables, y
 *      el backend tampoco las infiere para sistemas (`variables` es
 *      obligatorio en SystemRequest) — así que se pide en un campo chico
 *      que aparece solo cuando se detecta un sistema, en vez de adivinar
 *      con una heurística propia que podría fallar en silencio.
 *   2. Si no, y el texto convertido a sintaxis backend tiene "<"/">" ->
 *      POST /inequality (mismo criterio que EquationMode.tsx). Si tiene
 *      "=" -> POST /solve, SIN mandar `variable` (el backend infiere
 *      cuando hay una única variable libre, igual que EquationMode.tsx).
 *   3. Si no, expresión simple -> POST /evaluate, como antes.
 *
 * Fase 2 (fusión de modos): se agrega detectCalculusIntent() — derivada e
 * integral en notación natural. ESTO TOCA UNA DECISIÓN DE SEGURIDAD
 * ("Fase 0 v2", decisión de Carlos: el ícono "derivada" navega a
 * DerivativeMode en vez de insertar \frac{d}{dx} en Básico, y las teclas
 * ∫/Lim se quitaron del teclado). Ver calculusIntent.ts para la
 * explicación completa de por qué esto NO reabre esa vulnerabilidad (se
 * extrae la sub-expresión limpia en el cliente y se manda solo eso a los
 * mismos endpoints dedicados /derivative e /integral que ya usan
 * DerivativeMode.tsx/IntegralMode.tsx — nunca se le manda al backend un
 * string con \frac{d}{dx}(...) o \int...dx completo). Se implementa
 * porque se pidió explícitamente, dejando la explicación por escrito
 * para que el equipo lo revise antes de producción. Límite queda fuera a
 * propósito: no existe LimitMode.tsx para verificar el patrón contra un
 * uso real.
 */

import { useRef, useState, type FormEvent } from "react";
import type { MathfieldElement } from "mathlive";

import type { MathResponse } from "../api/client";
import { submitAndRecord } from "../api/submitWithHistory";
import { useUIStore } from "../store/useUIStore";
import { CalculatorScreen } from "./CalculatorScreen";
import { detectCalculusIntent, type CalculusIntent } from "./calculusIntent";
import { latexToBackendSyntax } from "./NaturalMathField";
import { NaturalMathKeyboard } from "./NaturalMathKeyboard";
import { splitSystemLatex } from "./systemSplit";

interface SubstitutionRow {
  name: string;
  value: string;
}

const EXAMPLES: { display: string; latex: string }[] = [
  { display: "2x + √9", latex: "2x+\\sqrt{9}" },
  { display: "sin(π/4)", latex: "\\sin\\left(\\frac{\\pi}{4}\\right)" },
  { display: "(3+4)²", latex: "(3+4)^{2}" },
  { display: "log(100)", latex: "\\log\\left(100\\right)" },
];

// Mismo patrón que EquationMode.tsx — se reusa el criterio de detección
// tal cual para que "escribo < o >, se resuelve como desigualdad" se
// comporte igual sin importar desde qué pantalla se escribió.
const INEQUALITY_OPERATOR_PATTERN = /[<>]/;

export function BasicMode() {
  const formRef = useRef<HTMLFormElement>(null);
  const [mathField, setMathField] = useState<MathfieldElement | null>(null);
  const [latex, setLatex] = useState("");
  const [angleUnit, setAngleUnit] = useState<"rad" | "deg">("rad");
  const [substitutions, setSubstitutions] = useState<SubstitutionRow[]>([]);
  const [systemVariables, setSystemVariables] = useState("x, y");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<MathResponse | null>(null);

  const setLoading = useUIStore((state) => state.setLoading);
  const setErrorMessage = useUIStore((state) => state.setErrorMessage);
  const isLoading = useUIStore((state) => state.isLoading);

  const systemRows = splitSystemLatex(latex);

  function addSubstitutionRow(): void {
    setSubstitutions((rows) => [...rows, { name: "", value: "" }]);
  }

  function updateSubstitutionRow(index: number, field: keyof SubstitutionRow, value: string): void {
    setSubstitutions((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  }

  function removeSubstitutionRow(index: number): void {
    setSubstitutions((rows) => rows.filter((_, i) => i !== index));
  }

  async function submitSystem(rows: string[]): Promise<void> {
    const equations = rows.map((row) => latexToBackendSyntax(row));
    if (equations.some((eq) => eq === "")) {
      setValidationError("Todas las ecuaciones del sistema deben tener contenido.");
      return;
    }
    if (equations.some((eq) => !eq.includes("="))) {
      setValidationError("Cada ecuación del sistema debe incluir un signo =.");
      return;
    }
    const variableList = systemVariables
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (variableList.length !== equations.length) {
      setValidationError(
        `El número de variables (${variableList.length}) debe coincidir con el de ecuaciones (${equations.length}). Ajústalas en "Variables del sistema".`,
      );
      return;
    }
    setValidationError(null);

    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await submitAndRecord(
        "/solve/system",
        { equations, variables: variableList },
        `Sistema: ${equations.join(" ; ")}`,
      );
      setLastResult(result);
      if (!result.success) {
        setErrorMessage(result.error_message ?? "Ocurrió un error.");
      }
    } finally {
      setLoading(false);
    }
  }

  // Fase 2: deriva/integra la sub-expresión LIMPIA extraída por
  // calculusIntent.ts — nunca el string \frac{d}{dx}(...) / \int...dx
  // completo. Mismos endpoints y misma forma de payload que
  // DerivativeMode.tsx/IntegralMode.tsx.
  async function submitCalculus(intent: CalculusIntent): Promise<void> {
    const trimmedInner = latexToBackendSyntax(intent.innerLatex);
    if (!trimmedInner) {
      setValidationError("La expresión no puede estar vacía.");
      return;
    }
    setValidationError(null);

    setLoading(true);
    setErrorMessage(null);
    try {
      const result =
        intent.kind === "derivative"
          ? await submitAndRecord(
              "/derivative",
              { expression: trimmedInner, variable: intent.variable, order: intent.order },
              `d/d${intent.variable} [${trimmedInner}]`,
            )
          : await submitAndRecord(
              "/integral",
              {
                expression: trimmedInner,
                variable: intent.variable,
                ...(intent.lowerBound !== null
                  ? { lower_bound: intent.lowerBound, upper_bound: intent.upperBound }
                  : {}),
              },
              `∫ ${trimmedInner}`,
            );
      setLastResult(result);
      if (!result.success) {
        setErrorMessage(result.error_message ?? "Ocurrió un error.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (systemRows) {
      await submitSystem(systemRows);
      return;
    }

    const calculusIntent = detectCalculusIntent(latex);
    if (calculusIntent) {
      await submitCalculus(calculusIntent);
      return;
    }

    const trimmed = latexToBackendSyntax(latex);
    if (!trimmed) {
      setValidationError("La expresión no puede estar vacía.");
      return;
    }
    setValidationError(null);

    const isInequality = INEQUALITY_OPERATOR_PATTERN.test(trimmed);
    const isEquation = !isInequality && trimmed.includes("=");

    const substitutionsPayload =
      !isInequality && !isEquation && substitutions.length > 0
        ? Object.fromEntries(
            substitutions
              .filter((row) => row.name.trim() !== "")
              .map((row) => [row.name, row.value]),
          )
        : undefined;

    setLoading(true);
    setErrorMessage(null);
    try {
      const result = isInequality
        ? await submitAndRecord("/inequality", { inequality: trimmed }, trimmed)
        : isEquation
          ? await submitAndRecord("/solve", { equation: trimmed, angle_unit: angleUnit }, trimmed)
          : await submitAndRecord(
              "/evaluate",
              {
                expression: trimmed,
                angle_unit: angleUnit,
                ...(substitutionsPayload ? { substitutions: substitutionsPayload } : {}),
              },
              trimmed,
            );
      setLastResult(result);
      if (!result.success) {
        setErrorMessage(result.error_message ?? "Ocurrió un error.");
      }
    } finally {
      setLoading(false);
    }
  }

  // Íconos de resolución del teclado — antes ninguno estaba cableado acá
  // (MathKeyboard los soporta desde Fase A/1 del proyecto, pero BasicMode
  // nunca les pasaba callbacks). "f(x)=0": inserta "=0" si el campo no
  // tiene ecuación todavía; si ya la tiene, resuelve. Sistema: inserta la
  // plantilla \begin{cases} si el campo no tiene una todavía; si ya la
  // tiene, resuelve.
  function handleSolveEquation(): void {
    if (!latex.includes("=")) {
      mathField?.focus();
      mathField?.insert("=0");
      return;
    }
    formRef.current?.requestSubmit();
  }

  function handleSolveSystem(): void {
    if (!splitSystemLatex(latex)) {
      mathField?.focus();
      mathField?.insert("\\begin{cases}#0\\\\#1\\end{cases}");
      return;
    }
    formRef.current?.requestSubmit();
  }

  function handleSimplify(): void {
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} aria-labelledby="basic-mode-heading" className="space-y-6">
      <h2 id="basic-mode-heading" className="sr-only">
        Básico
      </h2>

      <CalculatorScreen
        latex={latex}
        onLatexChange={setLatex}
        ariaLabel="Expresión"
        placeholder="2x + √9"
        fieldRef={setMathField}
        angleUnit={angleUnit}
        onToggleAngleUnit={() => setAngleUnit((u) => (u === "rad" ? "deg" : "rad"))}
        result={lastResult}
        isLoading={isLoading}
        onClearField={() => setLatex("")}
      />

      {systemRows && (
        <div className="-mt-4 flex flex-wrap items-center gap-2 px-2">
          <label htmlFor="system-variables-inline" className="text-xs text-muted">
            Variables del sistema (separadas por coma, {systemRows.length} ecuaciones detectadas):
          </label>
          <input
            id="system-variables-inline"
            type="text"
            value={systemVariables}
            onChange={(e) => setSystemVariables(e.target.value)}
            className="w-32 rounded border border-paper-line bg-paper-soft px-2 py-1 text-xs text-ink"
          />
        </div>
      )}

      {validationError && (
        <p role="alert" className="-mt-4 px-2 text-sm text-red-600">
          {validationError}
        </p>
      )}

      <NaturalMathKeyboard
        field={mathField}
        onSubmit={() => formRef.current?.requestSubmit()}
        onClearField={() => setLatex("")}
        onSolveEquation={handleSolveEquation}
        onSolveSystem={handleSolveSystem}
        onSimplify={handleSimplify}
        showCalculusStrip
      />

      <div className="flex flex-wrap gap-2">
        <span className="pt-1.5 text-xs font-medium text-muted">Ejemplos:</span>
        {EXAMPLES.map((example) => (
          <button
            key={example.display}
            type="button"
            onClick={() => setLatex(example.latex)}
            className="rounded-full border border-paper-line bg-paper-soft px-3 py-1 text-xs text-muted hover:border-marker/40 hover:text-marker"
          >
            {example.display}
          </button>
        ))}
      </div>

      <details className="group rounded-lg border border-paper-line bg-paper-soft open:pb-3">
        <summary className="cursor-pointer list-none px-4 py-2.5 text-sm font-medium text-muted marker:content-none">
          Opciones avanzadas (sustituciones)
        </summary>
        <div className="space-y-4 px-4 pt-1">
          <div className="space-y-2">
            <span className="block text-sm text-muted">Sustituciones (opcional, solo aplica a expresiones simples)</span>
            {substitutions.map((row, index) => (
              <div key={index} className="flex gap-2">
                <input
                  aria-label={`Nombre de la variable ${index + 1}`}
                  value={row.name}
                  onChange={(e) => updateSubstitutionRow(index, "name", e.target.value)}
                  className="w-24 rounded border border-paper-line bg-paper-soft px-2 py-1 text-sm text-ink"
                />
                <input
                  aria-label={`Valor de la variable ${index + 1}`}
                  value={row.value}
                  onChange={(e) => updateSubstitutionRow(index, "value", e.target.value)}
                  className="w-24 rounded border border-paper-line bg-paper-soft px-2 py-1 text-sm text-ink"
                />
                <button
                  type="button"
                  onClick={() => removeSubstitutionRow(index)}
                  aria-label={`Eliminar sustitución ${index + 1}`}
                  className="text-sm text-muted hover:text-muted"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addSubstitutionRow}
              className="text-sm text-marker hover:text-marker-text"
            >
              + Añadir sustitución
            </button>
          </div>
        </div>
      </details>
    </form>
  );
}
