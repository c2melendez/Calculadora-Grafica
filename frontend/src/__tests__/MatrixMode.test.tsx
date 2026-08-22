import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MatrixMode } from "../components/MatrixMode";

vi.mock("../api/client", () => ({
  callApi: vi.fn(),
}));

import { callApi } from "../api/client";

const mockedCallApi = vi.mocked(callApi);

beforeEach(() => {
  mockedCallApi.mockReset();
  mockedCallApi.mockResolvedValue({
    success: true,
    operation: "matrix_operation",
    request_id: "id",
    steps: [],
    has_detailed_steps: false,
    warnings: [],
    duration_ms: 1,
  } as never);
});

describe("MatrixMode", () => {
  it("arma el payload correcto contra /matrix/operations con una matriz 2x2 completa", async () => {
    render(<MatrixMode />);
    fireEvent.change(screen.getByLabelText("Matriz A celda fila 1 columna 1"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText("Matriz A celda fila 1 columna 2"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("Matriz A celda fila 2 columna 1"), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByLabelText("Matriz A celda fila 2 columna 2"), {
      target: { value: "4" },
    });
    fireEvent.change(screen.getByLabelText("Matriz B celda fila 1 columna 1"), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByLabelText("Matriz B celda fila 1 columna 2"), {
      target: { value: "6" },
    });
    fireEvent.change(screen.getByLabelText("Matriz B celda fila 2 columna 1"), {
      target: { value: "7" },
    });
    fireEvent.change(screen.getByLabelText("Matriz B celda fila 2 columna 2"), {
      target: { value: "8" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Calcular" }).closest("form")!);

    await waitFor(() => expect(mockedCallApi).toHaveBeenCalled());

    expect(mockedCallApi).toHaveBeenCalledWith("/matrix/operations", {
      operation: "add",
      matrix_a: [
        ["1", "2"],
        ["3", "4"],
      ],
      matrix_b: [
        ["5", "6"],
        ["7", "8"],
      ],
    });
  });

  it("no llama a la API si alguna celda está vacía (payload inválido)", () => {
    render(<MatrixMode />);
    fireEvent.change(screen.getByLabelText("Matriz A celda fila 1 columna 1"), {
      target: { value: "1" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Calcular" }).closest("form")!);

    expect(screen.getByRole("alert")).toHaveTextContent("deben tener un valor");
    expect(mockedCallApi).not.toHaveBeenCalled();
  });
});
