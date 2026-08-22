/**
 * src/store/useHistoryStore.ts — historial PERSISTENTE (spec, sección 11).
 *
 * `HISTORY_SCHEMA_VERSION` distinto -> descarte seguro (nunca un crash por
 * datos de una versión anterior incompatible). Límite 50 entradas.
 * `reuseEntry` valida `endpointUrl` contra `KNOWN_ENDPOINTS`. Sin
 * `localStorage` disponible (modo privado, cuota excedida, etc.), la app
 * sigue funcionando — solo se pierde la persistencia entre sesiones, el
 * estado en memoria de esta sesión funciona igual.
 */

import { create } from "zustand";

import { isKnownEndpoint } from "../api/endpoints";

export const HISTORY_SCHEMA_VERSION = 1;
export const HISTORY_STORAGE_KEY = "calculadora-cientifica-history";
export const HISTORY_MAX_ENTRIES = 50;

export interface HistoryEntry {
  id: string;
  operation: string;
  endpointUrl: string;
  requestPayload: Record<string, unknown>;
  inputText?: string;
  label: string;
  resultLatex?: string;
  resultText?: string;
  resultType?: string;
  hasDetailedSteps: boolean;
  warnings: string[];
  timestamp: number;
}

export interface HistoryStorageShape {
  schemaVersion: number;
  entries: HistoryEntry[];
}

interface HistoryState {
  entries: HistoryEntry[];
  addEntry: (entry: Omit<HistoryEntry, "id" | "timestamp">) => void;
  clearHistory: () => void;
  reuseEntry: (id: string) => HistoryEntry | null;
}

function loadPersistedEntries(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<HistoryStorageShape>;
    if (parsed.schemaVersion !== HISTORY_SCHEMA_VERSION) {
      return []; // Descarte seguro (sección 11).
    }
    if (!Array.isArray(parsed.entries)) return [];
    return parsed.entries;
  } catch {
    return [];
  }
}

function persistEntries(entries: HistoryEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    const shape: HistoryStorageShape = { schemaVersion: HISTORY_SCHEMA_VERSION, entries };
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(shape));
  } catch {
    // Ignorado a propósito: sin localStorage, la app sigue funcionando
    // sin historial persistente (sección 11).
  }
}

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `entry-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  entries: loadPersistedEntries(),

  addEntry: (entry) => {
    const newEntry: HistoryEntry = { ...entry, id: generateId(), timestamp: Date.now() };
    const updated = [newEntry, ...get().entries].slice(0, HISTORY_MAX_ENTRIES);
    persistEntries(updated);
    set({ entries: updated });
  },

  clearHistory: () => {
    persistEntries([]);
    set({ entries: [] });
  },

  reuseEntry: (id) => {
    const entry = get().entries.find((candidate) => candidate.id === id);
    if (!entry) return null;
    if (!isKnownEndpoint(entry.endpointUrl)) return null;
    return entry;
  },
}));
