/**
 * src/api/submitWithHistory.ts — envuelve `callApi` registrando cada
 * intento en `useHistoryStore` (spec, sección 11: History conectado,
 * `reuseEntry` valida `endpointUrl` contra `KNOWN_ENDPOINTS` antes de
 * reejecutar — la validación vive en el propio store, esto solo alimenta
 * las entradas).
 */

import { useHistoryStore } from "../store/useHistoryStore";
import { callApi, type MathResponse } from "./client";
import type { KnownEndpoint } from "./endpoints";

export async function submitAndRecord(
  endpoint: KnownEndpoint,
  payload: Record<string, unknown>,
  label: string,
): Promise<MathResponse> {
  const result = await callApi(endpoint, payload);

  useHistoryStore.getState().addEntry({
    operation: result.operation,
    endpointUrl: endpoint,
    requestPayload: payload,
    inputText: label,
    label,
    resultLatex: result.success ? (result.result_latex ?? undefined) : undefined,
    resultText: result.success ? (result.result_text ?? undefined) : undefined,
    resultType: result.success ? (result.result_type ?? undefined) : undefined,
    hasDetailedSteps: result.has_detailed_steps,
    warnings: result.warnings,
  });

  return result;
}
