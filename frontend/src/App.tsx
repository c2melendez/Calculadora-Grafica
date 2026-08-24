/**
 * src/App.tsx — layout base + selector de modos + historial (spec,
 * sección 11, Módulo 12).
 *
 * Accesibilidad final (Módulo 12): skip-link al contenido principal,
 * `aria-current` en el modo activo, `aria-expanded` en el toggle de
 * historial, foco visible (`focus-visible:outline`) en todos los
 * controles interactivos añadidos aquí.
 */

import { useState } from "react";

import { BasicMode } from "./components/BasicMode";
import { DerivativeMode } from "./components/DerivativeMode";
import { EquationMode } from "./components/EquationMode";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { GraphMode } from "./components/GraphMode";
import { History } from "./components/History";
import { IntegralMode } from "./components/IntegralMode";
import { MatrixMode } from "./components/MatrixMode";
import { SystemMode } from "./components/SystemMode";
import { ThemeToggle } from "./components/ThemeToggle";
import { useUIStore, type CalculatorMode } from "./store/useUIStore";

const MODE_LABELS: Record<CalculatorMode, string> = {
  basic: "Básico",
  derivative: "Derivada",
  integral: "Integral",
  equation: "Ecuación",
  system: "Sistemas",
  matrix: "Matrices",
  graph: "Gráficas",
};

const MODE_ORDER: CalculatorMode[] = [
  "basic",
  "derivative",
  "integral",
  "equation",
  "system",
  "matrix",
  "graph",
];

function ActiveModeForm({ mode }: { mode: CalculatorMode }) {
  switch (mode) {
    case "basic":
      return <BasicMode />;
    case "derivative":
      return <DerivativeMode />;
    case "integral":
      return <IntegralMode />;
    case "equation":
      return <EquationMode />;
    case "system":
      return <SystemMode />;
    case "matrix":
      return <MatrixMode />;
    case "graph":
      return <GraphMode />;
  }
}

export default function App() {
  const activeMode = useUIStore((state) => state.activeMode);
  const setActiveMode = useUIStore((state) => state.setActiveMode);
  const lastErrorMessage = useUIStore((state) => state.lastErrorMessage);
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-blue-600 focus:px-3 focus:py-2 focus:text-white"
      >
        Saltar al contenido principal
      </a>

      <header className="border-b border-stone-200 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <h1 className="text-lg font-semibold text-stone-900">
            Calculadora<span className="text-blue-600">Científica</span>
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowHistory((current) => !current)}
              aria-expanded={showHistory}
              aria-controls="history-panel"
              className="rounded-full border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              Historial
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <nav aria-label="Modos de la calculadora" className="border-b border-stone-200 bg-white px-6">
        <ul className="mx-auto flex max-w-3xl flex-wrap gap-6">
          {MODE_ORDER.map((mode) => (
            <li key={mode}>
              <button
                type="button"
                onClick={() => setActiveMode(mode)}
                aria-current={activeMode === mode ? "page" : undefined}
                className={`border-b-2 px-1 py-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
                  activeMode === mode
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-stone-500 hover:text-stone-800"
                }`}
              >
                {MODE_LABELS[mode]}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <main id="main-content" className="mx-auto max-w-3xl px-6 py-8">
        {lastErrorMessage && (
          <p role="alert" className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {lastErrorMessage}
          </p>
        )}

        {showHistory && (
          <section
            id="history-panel"
            aria-label="Historial de operaciones"
            className="mb-6 rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
          >
            <ErrorBoundary fallbackLabel="No se pudo mostrar el historial.">
              <History />
            </ErrorBoundary>
          </section>
        )}

        <section aria-live="polite" aria-label="Resultado">
          <ErrorBoundary fallbackLabel="No se pudo mostrar el resultado.">
            <ActiveModeForm mode={activeMode} />
          </ErrorBoundary>
        </section>
      </main>
    </div>
  );
}
