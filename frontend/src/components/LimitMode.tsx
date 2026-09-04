/**
 * src/components/LimitMode.tsx — modo Límite (spec, sección 2: "Sí —
 * sympy.limit()"): expresión + variable + punto (numérico o "oo"/"-oo")
 * + dirección, conectado a `POST /limit`.
 *
 * Antes de este archivo, `/limit` era un endpoint real y funcional
 * (`compute_limit` en `phase2_service.py`, "passthrough trivial REAL")
 * sin NINGÚN componente que lo llamara — verificado en vivo contra la
 * app real antes de escribir esto (limit(1/x,x→∞)=0,
 * limit((x²-4)/(x-2),x→2)=4, limit(1/x,x→0⁺)=∞, los tres correctos).
 *
 * Igual que Derivada/Integral/Ecuación/Sistema, este modo NO aparece en
 * la barra de pestañas (VISIBLE_MODES en App.tsx) — Carlos decidió que
 * esas pestañas se ocultaran porque el router de Fase 1/2 ya cubre el
 * caso común desde "Científica" (ver calculusIntent.ts). Límite sigue el
 * mismo criterio: existe como modo válido para casos que el router no
 * cubre (o para quien prefiera un formulario explícito), pero no ocupa
 * un lugar en la navegación principal.
 */

import { useRef, useState, type FormEvent } from "react";
import type { MathfieldElement } from "mathlive";

import type { MathResponse } from "../api/client";
import { submitAndRecord } from "../api/submitWithHistory";
import { useUIStore } from "../store/useUIStore";
import { CalculatorScreen } from "./CalculatorScreen";
import { latexToBackendSyntax } from "./NaturalMathField";
import { NaturalMathKeyboard } from "./NaturalMathKeyboard";

type Direction = "both" | "left" | "right";

export function LimitMode() {
  const formRef = useRef<HTMLFormElement>(null);
  const [latex, setLatex] = useState("");
  const [mathField, setMathField] = useState<MathfieldElement | null>(null);
  const [variable, setVariable] = useState("x");
  const [point, setPoint] = useState("0");
  const [direction, setDirection] = useState<Direction>("both");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<MathResponse | null>(null);

  const setLoading = useUIStore((state) => state.setLoading);
  const setErrorMessage = useUIStore((state) => state.setErrorMessage);
  const isLoading = useUIStore((state) => state.isLoading);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmedExpression = latexToBackendSyntax(latex);

    if (!trimmedExpression) {
      setValidationError("La expresión no puede estar vacía.");
      return;
    }
    const trimmedVariable = variable.trim();
    if (!trimmedVariable) {
      setValidationError("La variable no puede estar vacía.");
      return;
    }
    const trimmedPoint = point.trim();
    if (!trimmedPoint) {
      setValidationError('El punto no puede estar vacío (usa un número, "oo" o "-oo").');
      return;
    }
    setValidationError(null);

    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await submitAndRecord(
        "/limit",
        {
          expression: trimmedExpression,
          variable: trimmedVariable,
          point: trimmedPoint,
          direction,
        },
        `lim[${trimmedVariable}->${trimmedPoint}] ${trimmedExpression}`,
      );
      setLastResult(result);
      if (!result.success) {
        setErrorMessage(result.error_message ?? "Ocurrió un error.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      aria-labelledby="limit-mode-heading"
      className="space-y-4 rounded-lg border border-paper-line p-5 shadow-sm"
    >
      <h2 id="limit-mode-heading" className="text-sm font-medium text-muted">
        Límite
      </h2>

      <CalculatorScreen
        latex={latex}
        onLatexChange={setLatex}
        ariaLabel="Expresión"
        placeholder="sin(x)/x"
        fieldRef={setMathField}
        result={lastResult}
        isLoading={isLoading}
        onClearField={() => setLatex("")}
      />
      <NaturalMathKeyboard field={mathField} onSubmit={() => formRef.current?.requestSubmit()} />

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label htmlFor="limit-variable" className="block text-sm text-muted">
            Variable
          </label>
          <input
            id="limit-variable"
            type="text"
            value={variable}
            onChange={(e) => setVariable(e.target.value)}
            className="w-20 rounded border border-paper-line bg-paper-soft px-2 py-1 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="limit-point" className="block text-sm text-muted">
            Punto
          </label>
          <input
            id="limit-point"
            type="text"
            value={point}
            onChange={(e) => setPoint(e.target.value)}
            placeholder="0, oo, -oo"
            className="w-24 rounded border border-paper-line bg-paper-soft px-2 py-1 text-sm"
          />
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setPoint("oo")}
            className="rounded-full border border-paper-line px-2 py-1 text-xs hover:border-marker/40 hover:text-marker"
          >
            ∞
          </button>
          <button
            type="button"
            onClick={() => setPoint("-oo")}
            className="rounded-full border border-paper-line px-2 py-1 text-xs hover:border-marker/40 hover:text-marker"
          >
            −∞
          </button>
        </div>
        <div className="space-y-1">
          <label htmlFor="limit-direction" className="block text-sm text-muted">
            Lado
          </label>
          <select
            id="limit-direction"
            value={direction}
            onChange={(e) => setDirection(e.target.value as Direction)}
            className="rounded border border-paper-line bg-paper-soft px-2 py-1 text-sm"
          >
            <option value="both">ambos (x → a)</option>
            <option value="right">derecha (x → a⁺)</option>
            <option value="left">izquierda (x → a⁻)</option>
          </select>
        </div>
      </div>

      {validationError && (
        <p role="alert" className="text-sm text-red-600">
          {validationError}
        </p>
      )}

      <button
        type="submit"
        className="rounded bg-graph px-4 py-2 text-sm font-medium text-white hover:bg-graph/90"
      >
        Calcular límite
      </button>
    </form>
  );
}
