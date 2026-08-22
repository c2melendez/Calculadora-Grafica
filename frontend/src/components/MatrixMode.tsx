/**
 * src/components/MatrixMode.tsx — modo Matrices (spec, sección 11):
 * selector de dimensión NxM para A y B, inputs de texto con validación,
 * conectado a `POST /matrix/operations`.
 */

import { useState, type FormEvent } from "react";

import type { MathResponse } from "../api/client";
import { submitAndRecord } from "../api/submitWithHistory";
import { useUIStore } from "../store/useUIStore";
import { ResultPanel } from "./ResultPanel";

type Operation = "add" | "subtract" | "multiply";

function emptyMatrix(rows: number, cols: number): string[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ""));
}

function resizeMatrix(matrix: string[][], rows: number, cols: number): string[][] {
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => matrix[r]?.[c] ?? ""),
  );
}

interface MatrixGridProps {
  label: string;
  matrix: string[][];
  rows: number;
  cols: number;
  onDimensionsChange: (rows: number, cols: number) => void;
  onCellChange: (row: number, col: number, value: string) => void;
}

function MatrixGrid({
  label,
  matrix,
  rows,
  cols,
  onDimensionsChange,
  onCellChange,
}: MatrixGridProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-300">{label}</span>
        <label className="text-xs text-slate-400">
          Filas
          <select
            aria-label={`Filas de ${label}`}
            value={rows}
            onChange={(e) => onDimensionsChange(Number(e.target.value), cols)}
            className="ml-1 rounded border border-slate-700 bg-slate-900 px-1 py-0.5"
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-400">
          Columnas
          <select
            aria-label={`Columnas de ${label}`}
            value={cols}
            onChange={(e) => onDimensionsChange(rows, Number(e.target.value))}
            className="ml-1 rounded border border-slate-700 bg-slate-900 px-1 py-0.5"
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div
        role="group"
        aria-label={`Celdas de ${label}`}
        className="inline-grid gap-1"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {matrix.map((row, r) =>
          row.map((cell, c) => (
            <input
              key={`${r}-${c}`}
              aria-label={`${label} celda fila ${r + 1} columna ${c + 1}`}
              value={cell}
              onChange={(e) => onCellChange(r, c, e.target.value)}
              className="w-14 rounded border border-slate-700 bg-slate-900 px-1 py-1 text-center text-sm"
            />
          )),
        )}
      </div>
    </div>
  );
}

export function MatrixMode() {
  const [operation, setOperation] = useState<Operation>("add");
  const [rowsA, setRowsA] = useState(2);
  const [colsA, setColsA] = useState(2);
  const [matrixA, setMatrixA] = useState<string[][]>(emptyMatrix(2, 2));
  const [rowsB, setRowsB] = useState(2);
  const [colsB, setColsB] = useState(2);
  const [matrixB, setMatrixB] = useState<string[][]>(emptyMatrix(2, 2));
  const [validationError, setValidationError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<MathResponse | null>(null);

  const setLoading = useUIStore((state) => state.setLoading);
  const setErrorMessage = useUIStore((state) => state.setErrorMessage);
  const isLoading = useUIStore((state) => state.isLoading);

  function handleDimensionsA(rows: number, cols: number): void {
    setRowsA(rows);
    setColsA(cols);
    setMatrixA((current) => resizeMatrix(current, rows, cols));
  }

  function handleDimensionsB(rows: number, cols: number): void {
    setRowsB(rows);
    setColsB(cols);
    setMatrixB((current) => resizeMatrix(current, rows, cols));
  }

  function hasEmptyCell(matrix: string[][]): boolean {
    return matrix.some((row) => row.some((cell) => cell.trim() === ""));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (hasEmptyCell(matrixA) || hasEmptyCell(matrixB)) {
      setValidationError("Todas las celdas de ambas matrices deben tener un valor.");
      return;
    }
    setValidationError(null);

    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await submitAndRecord(
        "/matrix/operations",
        {
          operation,
          matrix_a: matrixA,
          matrix_b: matrixB,
        },
        `Matrices ${rowsA}x${colsA} ${operation} ${rowsB}x${colsB}`,
      );
      setLastResult(result);
      if (!result.success) {
        setErrorMessage(result.error_message ?? "Ocurrió un error.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-labelledby="matrix-mode-heading" className="space-y-4">
      <h2 id="matrix-mode-heading" className="text-sm font-medium text-slate-300">
        Matrices
      </h2>

      <div className="space-y-1">
        <label htmlFor="matrix-operation" className="block text-sm text-slate-300">
          Operación
        </label>
        <select
          id="matrix-operation"
          value={operation}
          onChange={(e) => setOperation(e.target.value as Operation)}
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
        >
          <option value="add">Suma</option>
          <option value="subtract">Resta</option>
          <option value="multiply">Multiplicación</option>
        </select>
      </div>

      <MatrixGrid
        label="Matriz A"
        matrix={matrixA}
        rows={rowsA}
        cols={colsA}
        onDimensionsChange={handleDimensionsA}
        onCellChange={(r, c, value) =>
          setMatrixA((current) =>
            current.map((row, i) =>
              i === r ? row.map((cell, j) => (j === c ? value : cell)) : row,
            ),
          )
        }
      />

      <MatrixGrid
        label="Matriz B"
        matrix={matrixB}
        rows={rowsB}
        cols={colsB}
        onDimensionsChange={handleDimensionsB}
        onCellChange={(r, c, value) =>
          setMatrixB((current) =>
            current.map((row, i) =>
              i === r ? row.map((cell, j) => (j === c ? value : cell)) : row,
            ),
          )
        }
      />

      {validationError && (
        <p role="alert" className="text-sm text-red-400">
          {validationError}
        </p>
      )}

      <button
        type="submit"
        className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
      >
        Calcular
      </button>

      <div className="border-t border-slate-800 pt-4">
        <ResultPanel result={lastResult} isLoading={isLoading} />
      </div>
    </form>
  );
}
