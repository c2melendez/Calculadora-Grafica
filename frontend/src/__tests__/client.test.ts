import { afterEach, describe, expect, it, vi } from "vitest";

import { callApi, UnknownEndpointError } from "../api/client";

describe("callApi", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("sintetiza un MathResponse de error ante un fallo de red", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    const result = await callApi("/evaluate", { expression: "1+1" });

    expect(result.success).toBe(false);
    expect(result.error_code).toBe("INTERNAL_ERROR");
    expect(result.operation).toBe("evaluate");
    expect(result.request_id).toBeTruthy();
    expect(typeof result.duration_ms).toBe("number");
  });

  it("sintetiza un MathResponse de error ante un timeout (AbortError)", async () => {
    globalThis.fetch = vi.fn().mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          reject(new DOMException("Aborted", "AbortError"));
        }),
    );

    const result = await callApi("/derivative", { expression: "x**2", variable: "x", order: 1 });

    expect(result.success).toBe(false);
    expect(result.error_code).toBe("INTERNAL_ERROR");
    expect(result.operation).toBe("derivative");
    expect(result.error_message).toMatch(/tiempo máximo/);
  });

  it("sintetiza un MathResponse de error ante una respuesta no-JSON", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 502,
      json: () => Promise.reject(new SyntaxError("Unexpected token <")),
    } as unknown as Response);

    const result = await callApi("/evaluate", { expression: "1+1" });

    expect(result.success).toBe(false);
    expect(result.error_code).toBe("INTERNAL_ERROR");
    expect(result.error_message).toMatch(/no-JSON/);
  });

  it("sintetiza un MathResponse de error si el JSON no cumple el contrato mínimo", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ foo: "bar" }),
    } as unknown as Response);

    const result = await callApi("/evaluate", { expression: "1+1" });

    expect(result.success).toBe(false);
    expect(result.error_code).toBe("INTERNAL_ERROR");
    expect(result.error_message).toMatch(/contrato MathResponse/);
  });

  it("devuelve la respuesta real cuando el backend responde correctamente", async () => {
    const realResponse = {
      success: true,
      operation: "evaluate",
      request_id: "abc-123",
      steps: [],
      has_detailed_steps: false,
      warnings: [],
      duration_ms: 5.2,
      result_approx: 2,
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve(realResponse),
    } as unknown as Response);

    const result = await callApi("/evaluate", { expression: "1+1" });

    expect(result).toEqual(realResponse);
  });

  it("lanza UnknownEndpointError para un endpoint fuera de la whitelist", async () => {
    await expect(callApi("/no-existe", {})).rejects.toBeInstanceOf(UnknownEndpointError);
  });
});
