/**
 * src/components/ThemeToggle.tsx — modo oscuro por defecto, persistido
 * (spec, sección 11).
 */

import { useEffect } from "react";

import { useUIStore } from "../store/useUIStore";

export function ThemeToggle() {
  const theme = useUIStore((state) => state.theme);
  const toggleTheme = useUIStore((state) => state.toggleTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      aria-pressed={isDark}
      className="rounded-full border border-stone-300 px-3 py-1.5 text-sm text-stone-700 transition-colors hover:bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
    >
      {isDark ? "Modo oscuro" : "Modo claro"}
    </button>
  );
}
