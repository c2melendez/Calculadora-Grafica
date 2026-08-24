import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import App from "./App";
import "./index.css";

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
