import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MathKeyboard } from "../components/MathKeyboard";

describe("MathKeyboard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("inserta texto ASCII al pulsar una tecla", () => {
    let value = "";
    const onChange = (next: string) => {
      value = next;
    };
    const { rerender } = render(<MathKeyboard value={value} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Insertar π" }));
    expect(value).toBe("pi");

    // "sin" está directamente en la fila de trigonometría — ya no requiere
    // cambiar de pestaña (el teclado tipo Casio con capas SHIFT/ALPHA
    // reemplazó las pestañas Básico/Funciones).
    rerender(<MathKeyboard value={value} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Insertar sin" }));
    expect(value).toBe("pisin()");
  });

  it("SHIFT es de un solo disparo: aplica la variante shift a la siguiente tecla y luego se apaga", () => {
    let value = "";
    const onChange = (next: string) => {
      value = next;
    };
    const { rerender } = render(<MathKeyboard value={value} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "SHIFT" }));
    fireEvent.click(screen.getByRole("button", { name: "Insertar x²" }));
    expect(value).toBe("sqrt()");

    // Tras usarse, SHIFT se desactiva solo: la siguiente tecla vuelve a su
    // función normal (x², no √).
    rerender(<MathKeyboard value={value} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Insertar x²" }));
    expect(value).toBe("sqrt()**2");
  });

  it("muestra la vista previa cuando el valor inicial ya tiene contenido", () => {
    render(<MathKeyboard value="pi" onChange={() => {}} />);
    expect(screen.getByText("Vista previa (aproximada)")).toBeInTheDocument();
  });

  it("actualiza la vista previa solo después del debounce de 300ms tras un cambio", () => {
    const { rerender } = render(<MathKeyboard value="" onChange={() => {}} />);
    rerender(<MathKeyboard value="sqrt(4)" onChange={() => {}} />);

    // Antes de que pase el debounce, la vista previa aún no debe aparecer
    // (el valor "debounced" sigue siendo el vacío inicial).
    expect(screen.queryByText("Vista previa (aproximada)")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(300);
    });
    rerender(<MathKeyboard value="sqrt(4)" onChange={() => {}} />);

    expect(screen.getByText("Vista previa (aproximada)")).toBeInTheDocument();
  });
});
