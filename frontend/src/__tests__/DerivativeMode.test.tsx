import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DerivativeMode } from "../components/DerivativeMode";

vi.mock("../api/client", () => ({
  callApi: vi.fn(),
}));

import { callApi } from "../api/client";

const mockedCallApi = vi.mocked(callApi);

beforeEach(() => {
  mockedCallApi.mockReset();
  mockedCallApi.mockResolvedValue({
    success: true,
    operation: "derivative",
    request_id: "id",
    steps: [],
    has_detailed_steps: false,
    warnings: [],
    duration_ms: 1,
  } as never);
});

describe("DerivativeMode", () => {
  it("arma el payload correcto contra /derivative", async () => {
    render(<DerivativeMode />);
    fireEvent.change(screen.getByLabelText("Expresión"), { target: { value: "x**2" } });
    fireEvent.change(screen.getByLabelText("Orden"), { target: { value: "2" } });
    fireEvent.submit(screen.getByRole("button", { name: "Derivar" }).closest("form")!);

    await waitFor(() => expect(mockedCallApi).toHaveBeenCalled());

    expect(mockedCallApi).toHaveBeenCalledWith("/derivative", {
      expression: "x**2",
      variable: "x",
      order: 2,
    });
  });

  it("no llama a la API con orden fuera de rango (payload inválido)", () => {
    render(<DerivativeMode />);
    fireEvent.change(screen.getByLabelText("Expresión"), { target: { value: "x**2" } });
    fireEvent.change(screen.getByLabelText("Orden"), { target: { value: "9" } });
    fireEvent.submit(screen.getByRole("button", { name: "Derivar" }).closest("form")!);

    expect(screen.getByRole("alert")).toHaveTextContent("entre 1 y 5");
    expect(mockedCallApi).not.toHaveBeenCalled();
  });
});
