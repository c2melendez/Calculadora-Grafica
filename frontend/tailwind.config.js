/** @type {import('tailwindcss').Config} */
// Precision Lab — tokens de diseño compartidos con Precision Lab (Python).
// Los colores leen variables CSS (definidas en design-tokens.css) en vez de
// hex fijos, para soportar los 3 temas ([data-theme]: dark/light/high-contrast)
// sin duplicar componentes. Cambios aquí deben reflejarse también en el
// tailwind.config.js del proyecto Python para mantener paridad visual.
function withOpacity(varName) {
  return ({ opacityValue }) =>
    opacityValue === undefined
      ? `rgb(var(${varName}))`
      : `rgb(var(${varName}) / ${opacityValue})`;
}

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        chrome: {
          DEFAULT: withOpacity("--color-chrome"),
          soft: withOpacity("--color-chrome-soft"),
        },
        paper: {
          DEFAULT: withOpacity("--color-paper"),
          soft: withOpacity("--color-paper-soft"),
          line: withOpacity("--color-paper-line"),
        },
        ink: withOpacity("--color-ink"),
        bone: withOpacity("--color-bone"),
        marker: {
          DEFAULT: withOpacity("--color-marker"),
          soft: withOpacity("--color-marker-soft"),
          text: withOpacity("--color-marker-text"),
        },
        graph: {
          DEFAULT: withOpacity("--color-graph"),
          soft: withOpacity("--color-graph-soft"),
        },
        alpha: {
          DEFAULT: withOpacity("--color-alpha"),
          soft: withOpacity("--color-alpha-soft"),
        },
        muted: withOpacity("--color-muted"),
      },
      fontFamily: {
        display: ['"Space Grotesk"', "sans-serif"],
        sans: ["Inter", "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
    },
  },
  plugins: [],
};
