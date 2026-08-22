import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  HISTORY_MAX_ENTRIES,
  HISTORY_SCHEMA_VERSION,
  HISTORY_STORAGE_KEY,
  useHistoryStore,
  type HistoryEntry,
} from "../store/useHistoryStore";

function baseEntry(
  overrides: Partial<Omit<HistoryEntry, "id" | "timestamp">> = {},
): Omit<HistoryEntry, "id" | "timestamp"> {
  return {
    operation: "evaluate",
    endpointUrl: "/evaluate",
    requestPayload: { expression: "1+1" },
    label: "1+1",
    hasDetailedSteps: false,
    warnings: [],
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.clear();
  useHistoryStore.setState({ entries: [] });
});

describe("useHistoryStore", () => {
  it("agrega una entrada con id y timestamp generados", () => {
    useHistoryStore.getState().addEntry(baseEntry());
    const { entries } = useHistoryStore.getState();
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBeTruthy();
    expect(entries[0].timestamp).toBeGreaterThan(0);
    expect(entries[0].label).toBe("1+1");
  });

  it("respeta el límite de 50 entradas, descartando las más antiguas", () => {
    for (let i = 0; i < 55; i += 1) {
      useHistoryStore.getState().addEntry(baseEntry({ label: `entry-${i}` }));
    }
    const { entries } = useHistoryStore.getState();
    expect(entries).toHaveLength(HISTORY_MAX_ENTRIES);
    // La más reciente (entry-54) queda primera; la más antigua conservada
    // es entry-5 (se descartaron entry-0..entry-4).
    expect(entries[0].label).toBe("entry-54");
    expect(entries[entries.length - 1].label).toBe("entry-5");
  });

  it("persiste en localStorage con el schemaVersion correcto", () => {
    useHistoryStore.getState().addEntry(baseEntry());
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);
    expect(parsed.schemaVersion).toBe(HISTORY_SCHEMA_VERSION);
    expect(parsed.entries).toHaveLength(1);
  });

  it("reuseEntry devuelve la entrada si el endpointUrl está en la whitelist", () => {
    useHistoryStore.getState().addEntry(baseEntry({ endpointUrl: "/derivative" }));
    const [entry] = useHistoryStore.getState().entries;
    const reused = useHistoryStore.getState().reuseEntry(entry.id);
    expect(reused).not.toBeNull();
    expect(reused?.endpointUrl).toBe("/derivative");
  });

  it("reuseEntry devuelve null si el endpointUrl NO está en la whitelist", () => {
    useHistoryStore.getState().addEntry(baseEntry({ endpointUrl: "/no-existe" }));
    const [entry] = useHistoryStore.getState().entries;
    const reused = useHistoryStore.getState().reuseEntry(entry.id);
    expect(reused).toBeNull();
  });

  it("reuseEntry devuelve null para un id inexistente", () => {
    expect(useHistoryStore.getState().reuseEntry("id-inexistente")).toBeNull();
  });

  it("clearHistory vacía las entradas y la persistencia", () => {
    useHistoryStore.getState().addEntry(baseEntry());
    useHistoryStore.getState().clearHistory();
    expect(useHistoryStore.getState().entries).toHaveLength(0);
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    const parsed = JSON.parse(raw as string);
    expect(parsed.entries).toHaveLength(0);
  });
});

describe("useHistoryStore — descarte seguro por schemaVersion", () => {
  it("descarta datos persistidos con un schemaVersion distinto sin crashear", async () => {
    window.localStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 999, entries: [baseEntry({ label: "old" })] }),
    );
    // Reimportar el módulo para forzar la re-lectura de localStorage en la
    // inicialización del store (loadPersistedEntries se ejecuta una sola
    // vez, al crear el store).
    vi.resetModules();
    const { useHistoryStore: freshStore } = await import("../store/useHistoryStore");
    expect(freshStore.getState().entries).toHaveLength(0);
  });
});
