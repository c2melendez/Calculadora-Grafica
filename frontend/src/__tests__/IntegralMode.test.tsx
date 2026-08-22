import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IntegralMode } from "../components/IntegralMode";

vi.mock("../api/client", () => ({
  callApi: vi.fn(),
}));

import { callApi } from "../api/client";

const mockedCallApi = vi.mocked(callApi);

beforeEach(() => {
  mockedCallApi.mockReset();
  mockedCallApi.mockResolvedValue({
    success: true,
    operation: "integral",
    request_id: "id",
    steps: [],
    has_detailed_steps: false,
    warnings: [],
    duration_ms: 1,
  } as never);
});

describe("IntegralMode", () => {
  it("arma el payload correcto contra /integral (sin límites)", async () => {
    render(<IntegralMode />);
    fireEvent.change(screen.getByLabelText("Expresión"), { target: { value: "sin(x)" } });
    fireEvent.submit(screen.getByRole("button", { name: "Integrar" }).closest("form")!);

    await waitFor(() => expect(mockedCallApi).toHaveBeenCalled());

    expect(mockedCallApi).toHaveBeenCalledWith("/integral", {
      expression: "sin(x)",
      variable: "x",
    });
  });

  it("arma el payload correcto contra /integral (con límites)", async () => {
    render(<IntegralMode />);
    fireEvent.change(screen.getByLabelText("Expresión"), { target: { value: "x**2" } });
    fireEvent.change(screen.getByLabelText("Límite inferior (opcional)"), {
      target: { value: "0" },
    });
    fireEvent.change(screen.getByLabelText("Límite superior (opcional)"), {
      target: { value: "2" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Integrar" }).closest("form")!);

    await waitFor(() => expect(mockedCallApi).toHaveBeenCalled());

    expect(mockedCallApi).toHaveBeenCalledWith("/integral", {
      expression: "x**2",
      variable: "x",
      lower_bound: "0",
      upper_bound: "2",
    });
  });

  it("no llama a la API si solo se especifica un límite (payload inválido)", () => {
    render(<IntegralMode />);
    fireEvent.change(screen.getByLabelText("Expresión"), { target: { value: "x**2" } });
    fireEvent.change(screen.getByLabelText("Límite inferior (opcional)"), {
      target: { value: "0" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Integrar" }).closest("form")!);

    expect(screen.getByRole("alert")).toHaveTextContent("juntos o ninguno");
    expect(mockedCallApi).not.toHaveBeenCalled();
  });
});
