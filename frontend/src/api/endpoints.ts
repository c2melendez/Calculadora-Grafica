/**
 * src/api/endpoints.ts — whitelist de endpoints (spec, sección 11).
 *
 * Sincronizada MANUALMENTE con el backend (Módulos 1-9) — no se genera
 * automáticamente. Cada entrada de `KNOWN_ENDPOINTS` es una ruta relativa a
 * `VITE_API_BASE_URL` (que ya incluye el prefijo `/api/v1`, sección 9).
 *
 * Confirmado contra el OpenAPI real del backend en ejecución (Módulo 10):
 * 22 endpoints — 12 de Fase 1 (incluye /health) + 10 de Fase 2 (Módulos 1-9).
 */

export const KNOWN_ENDPOINTS = [
  // --- Fase 1 ---
  "/health",
  "/evaluate",
  "/simplify",
  "/factor",
  "/expand",
  "/solve",
  "/derivative",
  "/integral",
  "/matrix/operations",
  "/matrix/determinant",
  "/matrix/inverse",
  "/matrix/transpose",
  "/matrix/power",
  "/graph/2d",
  // --- Fase 2 (passthrough trivial real o UNSUPPORTED_IN_PHASE_1) ---
  "/solve/system",
  "/inequality",
  "/limit",
  "/series",
  "/matrix/eigen",
  "/integral/improper",
  "/graph/3d",
  "/graph/parametric",
  "/derivative/partial",
  "/derivative/implicit",
] as const;

export type KnownEndpoint = (typeof KNOWN_ENDPOINTS)[number];

export function isKnownEndpoint(path: string): path is KnownEndpoint {
  return (KNOWN_ENDPOINTS as readonly string[]).includes(path);
}
