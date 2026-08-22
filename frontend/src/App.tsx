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
import { ThemeToggle } from "./components/ThemeToggle";
import { useUIStore, type CalculatorMode } from "./store/useUIStore";

const MODE_LABELS: Record<CalculatorMode, string> = {
  basic: "Básico",
  derivative: "Derivada",
  integral: "Integral",
  equation: "Ecuación",
  matrix: "Matrices",
  graph: "Gráficas",
};

const MODE_ORDER: CalculatorMode[] = [
  "basic",
  "derivative",
  "integral",
  "equation",
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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-sky-600 focus:px-3 focus:py-2 focus:text-white"
      >
        Saltar al contenido principal
      </a>

      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <h1 className="text-lg font-semibold">Calculadora Científica</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowHistory((current) => !current)}
            aria-expanded={showHistory}
            aria-controls="history-panel"
            className="rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
          >
            Historial
          </button>
          <ThemeToggle />
        </div>
      </header>

      <nav aria-label="Modos de la calculadora" className="border-b border-slate-800 px-6 py-2">
        <ul className="flex flex-wrap gap-2">
          {MODE_ORDER.map((mode) => (
            <li key={mode}>
              <button
                type="button"
                onClick={() => setActiveMode(mode)}
                aria-current={activeMode === mode ? "page" : undefined}
                className={`rounded px-3 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 ${
                  activeMode === mode
                    ? "bg-sky-600 text-white"
                    : "text-slate-300 hover:bg-slate-800"
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
          <p role="alert" className="mb-4 rounded bg-red-950/40 p-3 text-sm text-red-300">
            {lastErrorMessage}
          </p>
        )}

        {showHistory && (
          <section
            id="history-panel"
            aria-label="Historial de operaciones"
            className="mb-6 rounded-lg border border-slate-800 bg-slate-900/50 p-4"
          >
            <ErrorBoundary fallbackLabel="No se pudo mostrar el historial.">
              <History />
            </ErrorBoundary>
          </section>
        )}

        <section
          aria-live="polite"
          aria-label="Resultado"
          className="rounded-lg border border-slate-800 bg-slate-900/50 p-4"
        >
          <ErrorBoundary fallbackLabel="No se pudo mostrar el resultado.">
            <ActiveModeForm mode={activeMode} />
          </ErrorBoundary>
        </section>
      </main>
    </div>
  );
}
