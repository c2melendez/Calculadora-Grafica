import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { History } from "../components/History";
import { useHistoryStore } from "../store/useHistoryStore";

vi.mock("../api/client", async () => {
  const actual = await vi.importActual<typeof import("../api/client")>("../api/client");
  return { ...actual, callApi: vi.fn() };
});

import { callApi } from "../api/client";

const mockedCallApi = vi.mocked(callApi);

beforeEach(() => {
  mockedCallApi.mockReset();
  useHistoryStore.setState({ entries: [] });
});

describe("History", () => {
  it("muestra el mensaje vacío cuando no hay entradas", () => {
    render(<History />);
    expect(screen.getByText(/no hay historial/)).toBeInTheDocument();
  });

  it("Reusar reejecuta la llamada con el endpoint y payload guardados (endpoint válido)", async () => {
    useHistoryStore.getState().addEntry({
      operation: "derivative",
      endpointUrl: "/derivative",
      requestPayload: { expression: "x**2", variable: "x", order: 1 },
      label: "d/dx [x**2]",
      hasDetailedSteps: true,
      warnings: [],
    });
    mockedCallApi.mockResolvedValue({
      success: true,
      operation: "derivative",
      request_id: "id",
      result_text: "2*x",
      steps: [],
      has_detailed_steps: true,
      warnings: [],
      duration_ms: 1,
    } as never);

    render(<History />);
    fireEvent.click(screen.getByRole("button", { name: /Reusar entrada/ }));

    await waitFor(() =>
      expect(mockedCallApi).toHaveBeenCalledWith("/derivative", {
        expression: "x**2",
        variable: "x",
        order: 1,
      }),
    );
    await screen.findByText("2*x");
  });

  it("Reusar con un endpointUrl fuera de KNOWN_ENDPOINTS no reejecuta la llamada", async () => {
    useHistoryStore.setState({
      entries: [
        {
          id: "corrupt-1",
          operation: "evaluate",
          endpointUrl: "/no-existe",
          requestPayload: { expression: "1+1" },
          label: "entrada corrupta",
          hasDetailedSteps: false,
          warnings: [],
          timestamp: Date.now(),
        },
      ],
    });

    render(<History />);
    fireEvent.click(screen.getByRole("button", { name: /Reusar entrada/ }));

    expect(screen.getByRole("alert")).toHaveTextContent("no reconocido");
    expect(mockedCallApi).not.toHaveBeenCalled();
  });

  it("Borrar historial vacía la lista", () => {
    useHistoryStore.getState().addEntry({
      operation: "evaluate",
      endpointUrl: "/evaluate",
      requestPayload: { expression: "1+1" },
      label: "1+1",
      hasDetailedSteps: false,
      warnings: [],
    });
    render(<History />);
    fireEvent.click(screen.getByRole("button", { name: "Borrar historial" }));
    expect(screen.getByText(/no hay historial/)).toBeInTheDocument();
  });
});
