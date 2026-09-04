/**
 * src/components/NaturalMathKeyboard.tsx — teclado para NaturalMathField.
 * Inserta LaTeX vía `MathfieldElement.insert()` con plantillas `#0`/`#1`
 * (MathLive mueve el cursor ahí automáticamente).
 *
 * Fase A (spec UX estilo ClassCalc): reemplaza las capas SHIFT/ALPHA de
 * la Fase 1/2 por el patrón real de ClassCalc — rejilla base fija (más
 * usados) + pestañas Trig/Stat que abren un menú flotante con más
 * funciones (sin ocultar la rejilla base), placeholders de caja vacía □
 * en vez de letras, glifos matemáticos reales en cada tecla.
 *
 * Rediseño (pedido de Carlos, con capturas de referencia de ClassCalc,
 * idéntico al de precision-lab-lite/src/components/MathKeyboard.tsx):
 * - ∫/Σ/d/dx/Lim vuelven, ahora en una tira de Cálculo de 2 renglones
 *   debajo de los 3 íconos de resolución — antes se habían quitado
 *   ("Fase 0 v2, Fase 10") porque no había forma segura de resolverlas.
 *   Ahora SÍ hay: calculusIntent.ts (Fase 2) detecta derivada/integral
 *   en notación natural en Básico y manda solo la sub-expresión limpia a
 *   /derivative // /integral — por eso estas teclas ya no necesitan
 *   "onGoToDerivative" para funcionar ahí, a diferencia de antes.
 * - Límite YA es funcional para punto finito e infinito (patch de
 *   Carlos: LimitMode.tsx + detectLimit() en calculusIntent.ts, /limit
 *   ya funcionaba en el backend, solo faltaba el frontend). Lateral
 *   (x\to0^+/0^-) queda marcado `unavailable` — Compute Engine 0.58.0 da
 *   MathJSON sin sentido para esa notación (confirmado por el propio
 *   patch), detectLimit() devuelve null y cae al flujo normal, que el
 *   backend rechaza (Limit sigue bloqueado en ast_validator.py fuera de
 *   /limit) — mejor un aviso claro que ese error confuso. Para lateral,
 *   la única vía es el formulario dedicado LimitMode.tsx (sin pestaña
 *   visible, mismo criterio que Derivada/Integral/Ecuación/Sistema).
 * - ∬/∭ y variantes con límites de integración: quitadas, no solo
 *   visuales (decisión de Carlos).
 * - d²/dx² y órdenes mayores SÍ están cubiertas por calculusIntent
 *   (backend admite order 1-5) — la tecla de "orden n" inserta un "3"
 *   literal editable (no "n"), para no caer en silencio a orden 1 si el
 *   usuario no lo cambia (mismo criterio que en Lite).
 * - Se quita la pestaña "Alg": mod/GCD/LCM se reubican en "Stat".
 * - Multiplicación inserta \cdot (punto) en vez de \times.
 * - ÷ inserta directamente la plantilla de fracción.
 * - Se agrega un renglón de operadores relacionales (<, >, ≤, ≥).
 * - La tira de Cálculo solo tiene sentido donde el campo es "una
 *   expresión libre que puede llevar notación de cálculo" (Básico, vía
 *   calculusIntent) — en Gráfica/Sistema/etc. el campo tiene otro
 *   significado (y=f(x), una ecuación del sistema) y no aplica; se
 *   controla con la prop `showCalculusStrip` (default false).
 */

import type { MathfieldElement } from "mathlive";
import { useState } from "react";
import { KeyGlyph, type Glyph, BOX } from "./KeyGlyph";

interface KeyDef {
  glyph: Glyph;
  insertLatex: string;
  ariaLabel: string;
  /** Sin cómputo real detrás (∂/∂x) — presionarla muestra un aviso en
   * vez de insertar algo que el backend no puede resolver. */
  unavailable?: boolean;
}

const key = (glyph: Glyph, insertLatex: string, ariaLabel: string, unavailable?: boolean): KeyDef => ({
  glyph,
  insertLatex,
  ariaLabel,
  unavailable,
});

const BASE_GRID: KeyDef[][] = [
  [
    key("sin", "\\sin\\left(#0\\right)", "seno"),
    key("cos", "\\cos\\left(#0\\right)", "coseno"),
    key("tan", "\\tan\\left(#0\\right)", "tangente"),
    key("π", "\\pi", "pi"),
    key("θ", "\\theta", "theta"),
  ],
  [
    key("ln", "\\ln\\left(#0\\right)", "logaritmo natural"),
    key("log", "\\log\\left(#0\\right)", "logaritmo base 10"),
    key({ sub: BOX, base: "log" }, "\\log_{#0}\\left(#1\\right)", "logaritmo con base"),
    key("e", "e", "e"),
    key({ italic: "i" }, "i", "número imaginario"),
  ],
  [
    key({ sup: "2", base: BOX }, "#0^2", "al cuadrado"),
    key({ sup: "n", base: BOX }, "#0^{#1}", "potencia general"),
    key({ sqrt: BOX }, "\\sqrt{#0}", "raíz cuadrada"),
    key({ sqrt: BOX, index: "3" }, "\\sqrt[3]{#0}", "raíz cúbica"),
    key("∞", "\\infty", "infinito"),
  ],
  [
    key("|a|", "\\left|#0\\right|", "valor absoluto"),
    key("n!", "#0!", "factorial"),
    key({ italic: "x" }, "x", "variable x"),
    key({ italic: "y" }, "y", "variable y"),
    key("=", "=", "igual"),
  ],
];

const NUMPAD: KeyDef[][] = [
  [key("7", "7", "7"), key("8", "8", "8"), key("9", "9", "9"), key("÷", "\\frac{#0}{#1}", "dividir"), key("⌫", "", "borrar")],
  [key("4", "4", "4"), key("5", "5", "5"), key("6", "6", "6"), key("·", "\\cdot", "multiplicar"), key("(", "(", "paréntesis izquierdo")],
  [key("1", "1", "1"), key("2", "2", "2"), key("3", "3", "3"), key("−", "-", "restar"), key(")", ")", "paréntesis derecho")],
  [key("0", "0", "0"), key(".", ".", "punto"), key("%", "\\%", "porcentaje"), key("+", "+", "sumar"), key("=", "", "calcular")],
];

const RELATIONAL_ROW: KeyDef[] = [
  key("<", "<", "menor que"),
  key(">", ">", "mayor que"),
  key("≤", "\\le", "menor o igual que"),
  key("≥", "\\ge", "mayor o igual que"),
];

// ---- Tira de Cálculo (2 renglones). ∫/Σ/derivada resueltas de verdad
// vía calculusIntent.ts en Básico (o backend nativo para Σ/∫). Lim se
// agrega aquí SOLO como icono — Carlos está armando aparte el patch que
// las hace funcionales (no hay LimitMode ni detección de límite en
// calculusIntent.ts todavía, ver cabecera del archivo) — marcadas
// `unavailable` por honestidad mientras tanto: sin esto, presionarlas
// insertaría \lim_{...} que el backend rechaza (Limit sigue bloqueado en
// ast_validator.py) con un error confuso, no un aviso claro. Quitar el
// `unavailable`/agregar la 4ta insertLatex cuando ese patch aterrice. ----
const CALCULUS_ROW_1: KeyDef[] = [
  key("∫", "\\int #0\\,dx", "integral indefinida"),
  key({ base: "∫", sub: BOX, sup: BOX }, "\\int_{#0}^{#1}#2\\,dx", "integral definida"),
  key("Σ", "\\sum_{#0}^{#1}#2", "sumatoria"),
];

const CALCULUS_ROW_2: KeyDef[] = [
  key({ frac: ["d", "dx"] }, "\\frac{d}{dx}\\left(#0\\right)", "derivada"),
  key({ frac: ["d²", "dx²"] }, "\\frac{d^2}{dx^2}\\left(#0\\right)", "derivada segunda"),
  key({ frac: ["dⁿ", "dxⁿ"] }, "\\frac{d^3}{dx^3}\\left(#0\\right)", "derivada de orden n (edita el 3 por el orden que quieras, hasta 5)"),
  key({ frac: ["∂", "∂x"] }, "", "derivada parcial", true),
  key({ base: "lim", sub: "x→a" }, "\\lim_{#0\\to#1}#2", "límite"),
  key({ base: "lim", sub: "x→∞" }, "\\lim_{#0\\to\\infty}#1", "límite al infinito"),
  key({ base: "lim", sub: "x→a+" }, "\\lim_{#0\\to#1^+}#2", "límite lateral derecho", true),
  key({ base: "lim", sub: "x→a-" }, "\\lim_{#0\\to#1^-}#2", "límite lateral izquierdo", true),
];

const CATEGORY_MENUS: Record<string, { section: string; keys: KeyDef[] }[]> = {
  Trig: [
    { section: "Directas", keys: ["sin", "cos", "tan", "csc", "sec", "cot"].map((f) => key(f, `\\${f}\\left(#0\\right)`, f)) },
    {
      section: "Inversas",
      keys: ["sin", "cos", "tan", "csc", "sec", "cot"].map((f) =>
        key({ sup: "-1", base: f }, `\\${f}^{-1}\\left(#0\\right)`, `${f} inversa`),
      ),
    },
    {
      section: "Hiperbólicas",
      keys: ["sinh", "cosh", "tanh", "csch", "sech", "coth"].map((f) => key(f, `${f}\\left(#0\\right)`, f)),
    },
  ],
  Stat: [
    {
      section: "Básico",
      keys: [
        key("mean", "\\mathrm{mean}\\left(#0\\right)", "media"),
        key("median", "\\mathrm{median}\\left(#0\\right)", "mediana"),
        key("mode", "\\mathrm{mode}\\left(#0\\right)", "moda"),
        key("min", "\\min\\left(#0\\right)", "mínimo"),
        key("max", "\\max\\left(#0\\right)", "máximo"),
        key("range", "\\mathrm{range}\\left(#0\\right)", "rango"),
      ],
    },
    {
      section: "Avanzado",
      keys: [
        key("stdev", "\\mathrm{stdev}\\left(#0\\right)", "desviación estándar"),
        key("variance", "\\mathrm{var}\\left(#0\\right)", "varianza"),
        key({ sub: "n", base: "C" }, "\\mathrm{nCr}\\left(#0,#1\\right)", "combinaciones"),
        key({ sub: "n", base: "P" }, "\\mathrm{nPr}\\left(#0,#1\\right)", "permutaciones"),
        key("sort", "\\mathrm{sort}\\left(#0\\right)", "ordenar"),
        key("mad", "\\mathrm{mad}\\left(#0\\right)", "desviación absoluta media"),
      ],
    },
    {
      // Reubicadas desde la extinta pestaña "Alg" (rediseño del teclado).
      section: "Número entero",
      keys: [
        key("mod", "\\mathrm{mod}\\left(#0,#1\\right)", "módulo"),
        key("GCD", "\\gcd\\left(#0,#1\\right)", "máximo común divisor"),
        key("LCM", "\\mathrm{lcm}\\left(#0,#1\\right)", "mínimo común múltiplo"),
      ],
    },
  ],
};

const CATEGORIES = ["Trig", "Stat"] as const;

interface NaturalMathKeyboardProps {
  field: MathfieldElement | null;
  onSubmit?: () => void;
  onClearField?: () => void;
  onSolveEquation?: () => void;
  onSolveSystem?: () => void;
  onSimplify?: () => void;
  /** Fase 0 v2 (decisión de Carlos), ya no necesaria para la tira de
   * Cálculo (ver cabecera del archivo) — se deja como prop opcional por
   * si algún consumidor todavía la usa. */
  onGoToDerivative?: () => void;
  /** La tira de Cálculo solo tiene sentido donde el campo es una
   * expresión libre resuelta vía calculusIntent (Básico). Default false. */
  showCalculusStrip?: boolean;
}

export function NaturalMathKeyboard({
  field,
  onSubmit,
  onClearField,
  onSolveEquation,
  onSolveSystem,
  onSimplify,
  onGoToDerivative: _onGoToDerivative,
  showCalculusStrip = false,
}: NaturalMathKeyboardProps) {
  const [openCategory, setOpenCategory] = useState<(typeof CATEGORIES)[number] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function press(k: KeyDef): void {
    if (k.unavailable) {
      setNotice(`${k.ariaLabel}: todavía no disponible.`);
      window.setTimeout(() => setNotice(null), 2500);
      return;
    }
    field?.focus();
    if (k.insertLatex) field?.insert(k.insertLatex);
    setOpenCategory(null);
  }

  function pressBase(k: KeyDef): void {
    if (k.glyph === "⌫") {
      field?.focus();
      field?.executeCommand("deleteBackward");
      return;
    }
    if (k.glyph === "=" && k.insertLatex === "") return onSubmit?.();
    if (k.glyph === "f(x)=0") return onSolveEquation ? onSolveEquation() : press(k);
    press(k);
  }

  return (
    <div className="relative rounded-xl bg-chrome p-3">
      {notice && (
        <div className="absolute bottom-full left-3 right-3 mb-1.5 rounded-lg bg-chrome-soft px-3 py-2 text-center text-xs text-bone shadow-lg">
          {notice}
        </div>
      )}

      {openCategory && (
        <div className="absolute bottom-full left-3 right-3 mb-1.5 rounded-lg bg-chrome-soft p-3 shadow-lg">
          {CATEGORY_MENUS[openCategory].map((group) => (
            <div key={group.section} className="mb-2 last:mb-0">
              <div className="mb-1.5 text-[9px] uppercase tracking-wide text-bone/50">{group.section}</div>
              <div className="grid grid-cols-3 gap-1.5">
                {group.keys.map((k, i) => (
                  <button
                    key={`${group.section}-${i}`}
                    type="button"
                    onClick={() => press(k)}
                    aria-label={k.ariaLabel}
                    className="rounded-md bg-marker-soft/10 py-2 text-sm text-marker hover:bg-marker-soft/20"
                  >
                    <KeyGlyph glyph={k.glyph} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mb-1.5 grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={onSolveEquation}
          aria-label="Resolver ecuación"
          className="rounded-md bg-marker-soft/15 py-2 text-[11px] font-medium text-marker hover:bg-marker-soft/25"
        >
          f(x)=0
        </button>
        <button
          type="button"
          onClick={onSolveSystem}
          aria-label="Resolver sistema de ecuaciones"
          className="flex items-center justify-center gap-1 rounded-md bg-alpha-soft py-2 text-[10px] font-medium text-alpha hover:bg-alpha-soft/80"
        >
          <span className="text-base font-light">{"{"}</span>
          <span className="text-left leading-tight">
            f(x)=0
            <br />
            g(x)=0
          </span>
        </button>
        <button
          type="button"
          onClick={onSimplify}
          aria-label="Simplificar expresión"
          className="rounded-md bg-graph/15 py-2 text-[11px] font-medium text-graph hover:bg-graph/25"
        >
          a+a → 2a
        </button>
      </div>

      {showCalculusStrip && (
        <div className="relative mb-1.5 rounded-lg bg-chrome-soft/60 p-1.5">
          <div className="mb-1 grid grid-cols-3 gap-1">
            {CALCULUS_ROW_1.map((k, i) => (
              <button
                key={i}
                type="button"
                onClick={() => press(k)}
                aria-label={k.ariaLabel}
                className="rounded-md bg-chrome-soft py-1.5 text-[11px] text-bone hover:bg-chrome-soft/70"
              >
                <KeyGlyph glyph={k.glyph} />
              </button>
            ))}
          </div>
          <div className="grid grid-cols-8 gap-1">
            {CALCULUS_ROW_2.map((k, i) => (
              <button
                key={i}
                type="button"
                onClick={() => press(k)}
                aria-label={k.ariaLabel}
                className={
                  k.unavailable
                    ? "rounded-md bg-chrome-soft py-1.5 text-[10px] text-bone/40 hover:bg-chrome-soft/70"
                    : "rounded-md bg-chrome-soft py-1.5 text-[10px] text-bone hover:bg-chrome-soft/70"
                }
              >
                <KeyGlyph glyph={k.glyph} />
              </button>
            ))}
          </div>
          {onClearField && (
            <button
              type="button"
              onClick={onClearField}
              aria-label="Borrar todo el campo"
              title="Borrar todo"
              className="absolute -right-1 -top-1 rounded-md bg-chrome p-1.5 text-bone/70 hover:text-bone"
            >
              🗑
            </button>
          )}
        </div>
      )}

      <div className="mb-1.5 flex gap-3 px-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setOpenCategory((c) => (c === cat ? null : cat))}
            aria-expanded={openCategory === cat}
            className={openCategory === cat ? "text-xs font-semibold text-marker" : "text-xs text-bone/70"}
          >
            {cat}
          </button>
        ))}
      </div>

      {BASE_GRID.map((row, i) => (
        <div key={i} className="mb-1.5 grid grid-cols-10 gap-1">
          {row.map((k, j) => (
            <button
              key={j}
              type="button"
              onClick={() => pressBase(k)}
              aria-label={k.ariaLabel}
              className="rounded-md bg-chrome-soft py-2 text-[11px] text-bone hover:bg-chrome-soft/70"
            >
              <KeyGlyph glyph={k.glyph} />
            </button>
          ))}
          {NUMPAD[i].map((k, j) => (
            <button
              key={`n${j}`}
              type="button"
              onClick={() => pressBase(k)}
              aria-label={k.ariaLabel}
              className={
                /^[0-9.]$/.test(String(k.glyph))
                  ? "rounded-md bg-chrome-soft/80 py-2 text-sm font-medium text-bone hover:bg-chrome-soft/60"
                  : "rounded-md bg-chrome-soft py-2 text-[11px] text-bone hover:bg-chrome-soft/70"
              }
            >
              <KeyGlyph glyph={k.glyph} />
            </button>
          ))}
        </div>
      ))}

      <div className="grid grid-cols-4 gap-1">
        {RELATIONAL_ROW.map((k, i) => (
          <button
            key={i}
            type="button"
            onClick={() => press(k)}
            aria-label={k.ariaLabel}
            className="rounded-md bg-paper-soft py-1.5 text-sm text-ink hover:bg-paper-line/60"
          >
            <KeyGlyph glyph={k.glyph} />
          </button>
        ))}
      </div>
    </div>
  );
}
