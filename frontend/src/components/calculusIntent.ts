/**
 * src/components/calculusIntent.ts
 *
 * Fase 2 (fusión de modos, plan de 3 fases): detecta si el campo único de
 * BasicMode contiene una derivada o integral en notación natural, para
 * resolverla sin salir de la pantalla — mismo espíritu que systemSplit.ts
 * (Fase 1), y mismo diseño ya construido y verificado en Precision Lab
 * Lite (src/engine/parsing/calculusIntent.ts).
 *
 * =====================================================================
 * POR QUÉ ESTO TOCA UNA DECISIÓN DE SEGURIDAD, Y POR QUÉ SE HACE IGUAL
 * =====================================================================
 *
 * El backend tiene un validador de AST deliberado (`ast_validator.py`,
 * `BLOCKED_NODE_TYPES`) que rechaza `sympy.Derivative`, `sympy.Integral`,
 * `sympy.Sum`, `sympy.Product`, `sympy.Limit`, `sympy.Lambda` y
 * `sympy.MatrixBase` en CUALQUIER expresión que se parsee de forma
 * general (ej. lo que llega a /evaluate) — parte de un endurecimiento de
 * seguridad más amplio (también limita nodos, profundidad, dígitos y
 * exponentes; todo apunta a prevenir cómputo arbitrario/DoS vía SymPy).
 *
 * Por eso mismo, el ícono "derivada" del teclado (NaturalMathKeyboard.tsx)
 * NO inserta \frac{d}{dx}(...) en Básico — navega a DerivativeMode
 * (decisión "Fase 0 v2" de Carlos), y las teclas ∫/Lim se quitaron
 * directamente ("Fase 0 v2, Fase 10") porque en ese momento no había
 * forma segura de resolverlas inline ni un modo dedicado a donde
 * redirigir para integral.
 *
 * Este archivo NO reabre esa vulnerabilidad. La técnica es: reconocer la
 * notación en el CLIENTE, extraer la sub-expresión limpia (el argumento
 * de la derivada, el integrando) y mandar SOLO eso — nunca el string
 * "\frac{d}{dx}(...)" ni "\int...dx" completo — a los mismos endpoints
 * dedicados (/derivative, /integral) que ya usan con éxito
 * DerivativeMode.tsx e IntegralMode.tsx hoy. El validador de AST bloquea
 * Derivative/Integral cuando aparecen DENTRO de una expresión que se
 * parsea de forma general (ej. alguien escribiendo "Integral(x**2,x)" a
 * mano para colarlo por /evaluate) — nunca se le manda algo así. Es
 * exactamente el mismo patrón que ya usan los modos dedicados: la
 * "envoltura" (d/dx, ∫...dx) se interpreta y se descarta ANTES de tocar
 * la red; solo el contenido interno, ya limpio, llega al backend.
 *
 * Aun así, esto toca una decisión de seguridad con nombre y apellido
 * ("decisión de Carlos"). Se implementa porque así se pidió
 * explícitamente, dejando esta explicación para que el equipo (Carlos
 * incluido) lo revise antes de que se use en producción — no se está
 * dando por sentado que esto reemplaza esa revisión.
 *
 * LÍMITE se deja FUERA de este archivo a propósito: no existe
 * `LimitMode.tsx` en este proyecto (a diferencia de Lite, que sí tiene
 * `CalculusMode.tsx` con soporte de límite) — o sea, `/limit` no tiene
 * ningún uso real desde el frontend hoy contra el cual verificar el
 * patrón de payload. Agregar detección de límite sin un modo dedicado ya
 * probado sería repetir exactamente el problema que la Fase 0 v2 evitó
 * para ∫/Lim en primer lugar.
 *
 * =====================================================================
 * DOS TÉCNICAS DISTINTAS (mismo motivo que en Lite, reverificado acá)
 * =====================================================================
 *
 * Derivada: escáner propio (regex + balanceo de \left/\right) sobre el
 * patrón EXACTO que inserta el ícono del teclado — NO usa Compute
 * Engine. Se reverificó contra la versión de @cortex-js/compute-engine
 * instalada en ESTE proyecto (0.58.0, más nueva que la 0.24.1 de Lite):
 * \frac{d}{dx}(x^2) ahora sí da un operador D limpio, pero
 * \frac{d^2}{dx^2}(x^3) (orden 2) sigue fallando — vuelve a tratar "d"
 * como variable común. La inconsistencia entre órdenes confirma que
 * apoyarse en el motor externo para derivada sería frágil y dependiente
 * de versión; el escáner propio no tiene ese problema porque no le
 * importa qué hay adentro del paréntesis, solo la forma exacta del
 * template.
 *
 * Integral: sí se usa Compute Engine (reconocimiento confiable y
 * consistente en ambas versiones probadas), pero la forma del MathJSON
 * cambió entre versiones — acá es
 * ["Integrate", ["Function", ["Block", <cuerpo>], var], ["Limits", var, lowerOrNothing, upperOrNothing]]
 * en vez de ["Integrate", <cuerpo>, var|["Triple", var, lower, upper]]
 * como en Lite. Verificado directo contra el paquete real antes de
 * escribir este archivo, no asumido por similitud con Lite.
 */

import { ComputeEngine } from "@cortex-js/compute-engine";

export type CalculusIntent =
  | { kind: "derivative"; variable: string; order: 1 | 2 | 3 | 4 | 5; innerLatex: string }
  | { kind: "integral"; variable: string; lowerBound: string | null; upperBound: string | null; innerLatex: string };

// ---------------------------------------------------------------------
// Derivada (escáner propio — ver explicación arriba)
// ---------------------------------------------------------------------

// DerivativeRequest.order admite 1-5 en este backend (Lite solo admite
// 1-3) — el regex y la validación de rango reflejan eso.
const DERIVATIVE_PREFIX = /^\\frac\{d(?:\^\{?(\d)\}?)?\}\{d([a-zA-Z])(?:\^\{?(\d)\}?)?\}\\left\(/;

function findMatchingRightDelimiter(latex: string, fromIndex: number): number | null {
  let depth = 1;
  let i = fromIndex;
  while (i < latex.length) {
    if (latex.startsWith("\\left", i)) {
      depth++;
      i += 5;
      continue;
    }
    if (latex.startsWith("\\right", i)) {
      depth--;
      i += 6;
      if (depth === 0) return i + 1;
      continue;
    }
    i++;
  }
  return null;
}

/**
 * Exige que el template sea la expresión COMPLETA (ancla inicio y final)
 * — igual que en Lite, "2+\frac{d}{dx}(x^2)" NO matchea a propósito, para
 * no descartar el "2+" en silencio.
 */
function detectDerivative(latex: string): Extract<CalculusIntent, { kind: "derivative" }> | null {
  const trimmed = latex.trim();
  const m = DERIVATIVE_PREFIX.exec(trimmed);
  if (!m) return null;

  const orderRaw = m[1] ?? m[3];
  const order = orderRaw ? Number(orderRaw) : 1;
  if (order < 1 || order > 5) return null; // fuera de rango de DerivativeRequest.order

  const variable = m[2];
  const innerStart = m[0].length;
  const end = findMatchingRightDelimiter(trimmed, innerStart);
  if (end === null || end !== trimmed.length) return null;

  const innerLatex = trimmed.slice(innerStart, end - 7).trim();
  if (innerLatex.length === 0) return null;

  return { kind: "derivative", variable, order: order as 1 | 2 | 3 | 4 | 5, innerLatex };
}

// ---------------------------------------------------------------------
// Integral (Compute Engine, solo para reconocer la forma — ver
// explicación arriba sobre por qué esto no viola BLOCKED_NODE_TYPES)
// ---------------------------------------------------------------------

let ce: ComputeEngine | null = null;
function getComputeEngine(): ComputeEngine {
  if (!ce) ce = new ComputeEngine();
  return ce;
}

function detectIntegral(latex: string): Extract<CalculusIntent, { kind: "integral" }> | null {
  const trimmed = latex.trim();
  if (trimmed.length === 0) return null;

  let expr;
  try {
    expr = getComputeEngine().parse(trimmed);
  } catch {
    return null;
  }
  if (!expr || !Array.isArray(expr.json) || expr.json[0] !== "Integrate") return null;

  // ["Integrate", ["Function", ["Block", <cuerpo>], var], ["Limits", var, lowerOrNothing, upperOrNothing]]
  // Se navega solo por .json (no por .ops — la interfaz `Expression` de
  // esta versión de @cortex-js/compute-engine, 0.58.0, no expone
  // operandos como propiedad; se probó y confirmó contra el paquete
  // real, ver comentario de cabecera). Para volver a obtener LaTeX de un
  // fragmento de JSON se usa ce.box(fragment).latex.
  const [, fnJson, limitsJson] = expr.json;
  if (!Array.isArray(fnJson) || fnJson[0] !== "Function") return null;
  let bodyJson = fnJson[1];
  if (Array.isArray(bodyJson) && bodyJson[0] === "Block") bodyJson = bodyJson[1];

  const innerLatex = getComputeEngine().box(bodyJson).latex;
  if (!innerLatex) return null;

  if (!Array.isArray(limitsJson) || limitsJson[0] !== "Limits") return null;
  const [, variable, lower, upper] = limitsJson;
  if (typeof variable !== "string") return null;

  const lowerIsNothing = lower === "Nothing";
  const upperIsNothing = upper === "Nothing";
  if (lowerIsNothing !== upperIsNothing) return null; // deben ir juntos o ninguno

  if (lowerIsNothing) {
    return { kind: "integral", variable, lowerBound: null, upperBound: null, innerLatex };
  }
  if (typeof lower !== "number" || typeof upper !== "number") return null; // ej. límites simbólicos/infinito: fuera de alcance
  return { kind: "integral", variable, lowerBound: String(lower), upperBound: String(upper), innerLatex };
}

/** Punto de entrada único del router (BasicMode.tsx). Derivada primero
 * (más barato, solo regex); límite queda deliberadamente fuera — ver
 * comentario de cabecera. */
export function detectCalculusIntent(latex: string): CalculusIntent | null {
  return detectDerivative(latex) ?? detectIntegral(latex);
}
