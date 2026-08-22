import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

import { useHistoryStore } from "../store/useHistoryStore";

afterEach(() => {
  cleanup();
  // Evita contaminación entre tests: submitAndRecord (Módulo 12) escribe
  // en useHistoryStore/localStorage en cada submit exitoso o fallido.
  window.localStorage.clear();
  useHistoryStore.setState({ entries: [] });
});
