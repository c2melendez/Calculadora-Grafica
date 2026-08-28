/**
 * src/components/History.tsx — historial (spec, sección 11): conectado a
 * `useHistoryStore`; "Reusar" pasa por `reuseEntry` (que valida
 * `endpointUrl` contra `KNOWN_ENDPOINTS`, sección 11) antes de reejecutar
 * la llamada.
 */

import { useState } from "react";

import { callApi, type MathResponse } from "../api/client";
import { useHistoryStore, type HistoryEntry } from "../store/useHistoryStore";
import { ResultPanel } from "./ResultPanel";

export function History() {
  const entries = useHistoryStore((state) => state.entries);
  const reuseEntry = useHistoryStore((state) => state.reuseEntry);
  const clearHistory = useHistoryStore((state) => state.clearHistory);

  const [reusedResult, setReusedResult] = useState<MathResponse | null>(null);
  const [isReusing, setIsReusing] = useState(false);
  const [reuseError, setReuseError] = useState<string | null>(null);

  async function handleReuse(id: string): Promise<void> {
    setReuseError(null);
    const entry = reuseEntry(id);
    if (!entry) {
      // endpointUrl fuera de KNOWN_ENDPOINTS, o id inexistente — nunca se
      // reejecuta una llamada no validada (sección 11).
      setReuseError("No se pudo reutilizar esta entrada (endpoint no reconocido).");
      return;
    }
    setIsReusing(true);
    try {
      const result = await callApi(entry.endpointUrl, entry.requestPayload);
      setReusedResult(result);
    } finally {
      setIsReusing(false);
    }
  }

  if (entries.length === 0) {
    return <p className="text-sm text-muted">Todavía no hay historial en esta sesión.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted">Historial</h2>
        <button
          type="button"
          onClick={clearHistory}
          aria-label="Borrar historial"
          className="text-xs text-muted hover:text-ink"
        >
          Borrar historial
        </button>
      </div>

      <ul className="space-y-2">
        {entries.map((entry: HistoryEntry) => (
          <li
            key={entry.id}
            className="flex items-center justify-between rounded border border-paper-line bg-paper px-3 py-2"
          >
            <div>
              <p className="text-sm text-ink">{entry.label}</p>
              <p className="text-xs text-muted">{entry.operation}</p>
            </div>
            <button
              type="button"
              onClick={() => handleReuse(entry.id)}
              aria-label={`Reusar entrada: ${entry.label}`}
              className="rounded border border-paper-line px-2 py-1 text-xs text-muted hover:bg-paper-line/40"
            >
              Reusar
            </button>
          </li>
        ))}
      </ul>

      {reuseError && (
        <p role="alert" className="text-sm text-red-600">
          {reuseError}
        </p>
      )}

      {(isReusing || reusedResult) && (
        <div className="border-t border-paper-line pt-4">
          <ResultPanel result={reusedResult} isLoading={isReusing} />
        </div>
      )}
    </div>
  );
}
