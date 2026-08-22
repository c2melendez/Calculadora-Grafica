import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GraphMode } from "../components/GraphMode";

vi.mock("../api/client", () => ({
  callApi: vi.fn(),
}));

import { callApi } from "../api/client";

const mockedCallApi = vi.mocked(callApi);

beforeEach(() => {
  mockedCallApi.mockReset();
  mockedCallApi.mockResolvedValue({
    success: true,
    operation: "graph_2d",
    request_id: "id",
    steps: [],
    has_detailed_steps: false,
    warnings: [],
    duration_ms: 1,
  } as never);
});

describe("GraphMode", () => {
  it("arma el payload correcto contra /graph/2d con una sola expresión", async () => {
    render(<GraphMode />);
    fireEvent.change(screen.getByLabelText("Expresión 1"), { target: { value: "sin(x)" } });
    fireEvent.submit(screen.getByRole("button", { name: "Graficar" }).closest("form")!);

    await waitFor(() => expect(mockedCallApi).toHaveBeenCalled());

    expect(mockedCallApi).toHaveBeenCalledWith("/graph/2d", {
      expressions: ["sin(x)"],
      variable: "x",
      angle_unit: "rad",
    });
  });

  it("arma el payload correcto con dos expresiones y dominio explícito", async () => {
    render(<GraphMode />);
    fireEvent.change(screen.getByLabelText("Expresión 1"), { target: { value: "sin(x)" } });
    fireEvent.click(screen.getByRole("button", { name: "+ Añadir expresión" }));
    fireEvent.change(screen.getByLabelText("Expresión 2"), { target: { value: "cos(x)" } });
    fireEvent.change(screen.getByLabelText("x mínimo (opcional)"), { target: { value: "-5" } });
    fireEvent.change(screen.getByLabelText("x máximo (opcional)"), { target: { value: "5" } });
    fireEvent.submit(screen.getByRole("button", { name: "Graficar" }).closest("form")!);

    await waitFor(() => expect(mockedCallApi).toHaveBeenCalled());

    expect(mockedCallApi).toHaveBeenCalledWith("/graph/2d", {
      expressions: ["sin(x)", "cos(x)"],
      variable: "x",
      angle_unit: "rad",
      x_min: -5,
      x_max: 5,
    });
  });

  it("no llama a la API si solo se especifica x_min (payload inválido)", () => {
    render(<GraphMode />);
    fireEvent.change(screen.getByLabelText("Expresión 1"), { target: { value: "x" } });
    fireEvent.change(screen.getByLabelText("x mínimo (opcional)"), { target: { value: "-5" } });
    fireEvent.submit(screen.getByRole("button", { name: "Graficar" }).closest("form")!);

    expect(screen.getByRole("alert")).toHaveTextContent("juntos o ninguno");
    expect(mockedCallApi).not.toHaveBeenCalled();
  });
});
