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

type Operation =
  | "add"
  | "subtract"
  | "multiply"
  | "transpose"
  | "determinant"
  | "inverse"
  | "power"
  | "eigen";

const OPERATION_LABELS: Record<Operation, string> = {
  add: "Suma (A + B)",
  subtract: "Resta (A − B)",
  multiply: "Multiplicación (A × B)",
  transpose: "Transposición (Aᵀ)",
  determinant: "Determinante (|A|)",
  inverse: "Inversa (A⁻¹)",
  power: "Potencia (Aⁿ)",
  eigen: "Eigenvalores y eigenvectores",
};

const NEEDS_MATRIX_B: ReadonlySet<Operation> = new Set(["add", "subtract", "multiply"]);
const NEEDS_EXPONENT: ReadonlySet<Operation> = new Set(["power"]);

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
        <span className="text-sm text-stone-600">{label}</span>
        <label className="text-xs text-stone-400">
          Filas
          <select
            aria-label={`Filas de ${label}`}
            value={rows}
            onChange={(e) => onDimensionsChange(Number(e.target.value), cols)}
            className="ml-1 rounded border border-stone-300 bg-white px-1 py-0.5"
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-stone-400">
          Columnas
          <select
            aria-label={`Columnas de ${label}`}
            value={cols}
            onChange={(e) => onDimensionsChange(rows, Number(e.target.value))}
            className="ml-1 rounded border border-stone-300 bg-white px-1 py-0.5"
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
              className="w-14 rounded border border-stone-300 bg-white px-1 py-1 text-center text-sm"
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
  const [exponent, setExponent] = useState("2");
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

    if (hasEmptyCell(matrixA)) {
      setValidationError("Todas las celdas de la matriz A deben tener un valor.");
      return;
    }
    if (NEEDS_MATRIX_B.has(operation) && hasEmptyCell(matrixB)) {
      setValidationError("Todas las celdas de la matriz B deben tener un valor.");
      return;
    }
    if (NEEDS_EXPONENT.has(operation) && (exponent.trim() === "" || !/^-?\d+$/.test(exponent.trim()))) {
      setValidationError("El exponente debe ser un número entero.");
      return;
    }
    setValidationError(null);

    setLoading(true);
    setErrorMessage(null);
    try {
      let result: MathResponse;
      const label = `Matriz A ${rowsA}x${colsA} — ${OPERATION_LABELS[operation]}`;

      if (operation === "add" || operation === "subtract" || operation === "multiply") {
        result = await submitAndRecord(
          "/matrix/operations",
          { operation, matrix_a: matrixA, matrix_b: matrixB },
          `Matrices ${rowsA}x${colsA} ${operation} ${rowsB}x${colsB}`,
        );
      } else if (operation === "transpose") {
        result = await submitAndRecord("/matrix/transpose", { matrix: matrixA }, label);
      } else if (operation === "determinant") {
        result = await submitAndRecord("/matrix/determinant", { matrix: matrixA }, label);
      } else if (operation === "inverse") {
        result = await submitAndRecord("/matrix/inverse", { matrix: matrixA }, label);
      } else if (operation === "power") {
        result = await submitAndRecord(
          "/matrix/power",
          { matrix: matrixA, exponent: Number(exponent) },
          `${label} (n=${exponent})`,
        );
      } else {
        result = await submitAndRecord("/matrix/eigen", { matrix: matrixA }, label);
      }

      setLastResult(result);
      if (!result.success) {
        setErrorMessage(result.error_message ?? "Ocurrió un error.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-labelledby="matrix-mode-heading" className="space-y-4 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
      <h2 id="matrix-mode-heading" className="text-sm font-medium text-stone-600">
        Matrices
      </h2>

      <div className="space-y-1">
        <label htmlFor="matrix-operation" className="block text-sm text-stone-600">
          Operación
        </label>
        <select
          id="matrix-operation"
          value={operation}
          onChange={(e) => setOperation(e.target.value as Operation)}
          className="rounded border border-stone-300 bg-white px-2 py-1 text-sm"
        >
          {(Object.keys(OPERATION_LABELS) as Operation[]).map((op) => (
            <option key={op} value={op}>
              {OPERATION_LABELS[op]}
            </option>
          ))}
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

      {NEEDS_EXPONENT.has(operation) && (
        <div className="space-y-1">
          <label htmlFor="matrix-exponent" className="block text-sm text-stone-600">
            Exponente (entero, de -10 a 10)
          </label>
          <input
            id="matrix-exponent"
            type="text"
            inputMode="numeric"
            value={exponent}
            onChange={(e) => setExponent(e.target.value)}
            className="w-24 rounded border border-stone-300 bg-white px-2 py-1 text-sm"
          />
        </div>
      )}

      {NEEDS_MATRIX_B.has(operation) && (
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
      )}

      {validationError && (
        <p role="alert" className="text-sm text-red-600">
          {validationError}
        </p>
      )}

      <button
        type="submit"
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
      >
        Calcular
      </button>

      <div className="border-t border-stone-200 pt-4">
        <ResultPanel result={lastResult} isLoading={isLoading} />
      </div>
    </form>
  );
}
