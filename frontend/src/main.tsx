import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import App from "./App";
import "./index.css";
// BUG real (reportado por el usuario con captura: sqrt(7) se veía como
// "√7  7 / √" repetido y sin estilo). MathRenderer.tsx usa
// katex.renderToString(), que genera HTML plano — necesita este
// stylesheet para renderizar radicales/fracciones/potencias
// correctamente (posicionamiento absoluto de los símbolos, tamaños de
// fuente relativos, etc.). Sin él, el HTML de KaTeX se lee en su orden
// de fuente interno sin ningún layout matemático real.
import "katex/dist/katex.css";

registerSW({ immediate: true });

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("No se encontró el elemento #root.");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
