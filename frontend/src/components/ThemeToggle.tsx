import { useEffect, useState } from "react";

// Ciclo de 3 temas: dark → light → high-contrast → dark. Escribe
// data-theme en <html> (leído por design-tokens.css) y lo persiste en
// localStorage. Mismo componente para Precision Lab y Precision Lab Lite.

type Theme = "dark" | "light" | "high-contrast";
const ORDER: Theme[] = ["dark", "light", "high-contrast"];
const STORAGE_KEY = "precision-lab-theme";
const LABELS: Record<Theme, string> = {
  dark: "Oscuro",
  light: "Claro",
  "high-contrast": "Alto contraste",
};

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(STORAGE_KEY, theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const initial = stored && ORDER.includes(stored) ? stored : "dark";
    setTheme(initial);
    applyTheme(initial);
  }, []);

  function cycle() {
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    setTheme(next);
    applyTheme(next);
  }

  return (
    <button
      onClick={cycle}
      aria-label={`Tema: ${LABELS[theme]}. Cambiar tema.`}
      className="rounded-md bg-chrome-soft px-2.5 py-1 text-xs font-medium text-bone hover:bg-chrome-soft/70"
    >
      {LABELS[theme]}
    </button>
  );
}
