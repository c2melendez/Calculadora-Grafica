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

  it("transposición: oculta la matriz B y llama a /matrix/transpose solo con A", async () => {
    render(<MatrixMode />);
    fireEvent.change(screen.getByLabelText("Operación"), { target: { value: "transpose" } });

    expect(screen.queryByLabelText("Matriz B celda fila 1 columna 1")).not.toBeInTheDocument();

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
    fireEvent.submit(screen.getByRole("button", { name: "Calcular" }).closest("form")!);

    await waitFor(() => expect(mockedCallApi).toHaveBeenCalled());
    expect(mockedCallApi).toHaveBeenCalledWith("/matrix/transpose", {
      matrix: [
        ["1", "2"],
        ["3", "4"],
      ],
    });
  });

  it("potencia: muestra el campo de exponente y lo envía como número a /matrix/power", async () => {
    render(<MatrixMode />);
    fireEvent.change(screen.getByLabelText("Operación"), { target: { value: "power" } });

    fireEvent.change(screen.getByLabelText("Matriz A celda fila 1 columna 1"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText("Matriz A celda fila 1 columna 2"), {
      target: { value: "0" },
    });
    fireEvent.change(screen.getByLabelText("Matriz A celda fila 2 columna 1"), {
      target: { value: "0" },
    });
    fireEvent.change(screen.getByLabelText("Matriz A celda fila 2 columna 2"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText("Exponente (entero, de -10 a 10)"), {
      target: { value: "3" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Calcular" }).closest("form")!);

    await waitFor(() => expect(mockedCallApi).toHaveBeenCalled());
    expect(mockedCallApi).toHaveBeenCalledWith("/matrix/power", {
      matrix: [
        ["1", "0"],
        ["0", "1"],
      ],
      exponent: 3,
    });
  });

  it("potencia: rechaza un exponente no entero antes de llamar a la API", () => {
    render(<MatrixMode />);
    fireEvent.change(screen.getByLabelText("Operación"), { target: { value: "power" } });
    fireEvent.change(screen.getByLabelText("Matriz A celda fila 1 columna 1"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText("Matriz A celda fila 1 columna 2"), {
      target: { value: "0" },
    });
    fireEvent.change(screen.getByLabelText("Matriz A celda fila 2 columna 1"), {
      target: { value: "0" },
    });
    fireEvent.change(screen.getByLabelText("Matriz A celda fila 2 columna 2"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText("Exponente (entero, de -10 a 10)"), {
      target: { value: "1.5" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Calcular" }).closest("form")!);

    expect(screen.getByRole("alert")).toHaveTextContent("número entero");
    expect(mockedCallApi).not.toHaveBeenCalled();
  });
});
