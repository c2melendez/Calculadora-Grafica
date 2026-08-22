import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MathRenderer } from "../components/MathRenderer";

describe("MathRenderer", () => {
  it("renderiza LaTeX válido vía katex.renderToString (HTML generado por KaTeX)", () => {
    const { container } = render(<MathRenderer latex="x^{2}" />);
    // KaTeX genera sus propios nodos con la clase "katex" — confirma que
    // pasó por su API real, no que se insertó el texto crudo tal cual.
    expect(container.querySelector(".katex")).not.toBeNull();
    expect(container.textContent).not.toBe("x^{2}");
  });

  it("cae a texto plano (fallbackText) si KaTeX no puede parsear el input", () => {
    // OJO (hallazgo real): en JSX, un atributo de string LITERAL no procesa
    // secuencias de escape como un string JS normal — "\\left(" como
    // literal JSX quedaría como DOS backslashes reales, no uno. Hay que
    // envolverlo en {} para que se evalúe como expresión JS.
    render(<MathRenderer latex={"\\notacomando{roto"} fallbackText="texto de respaldo" />);
    expect(screen.getByText("texto de respaldo")).toBeInTheDocument();
  });

  it("cae al propio latex como texto si no hay fallbackText y KaTeX falla", () => {
    // "\left(" sin su "\right)" correspondiente es un ParseError real y
    // consistente de KaTeX (confirmado de forma aislada antes de escribir
    // este test).
    render(<MathRenderer latex={"\\left("} />);
    expect(screen.getByText("\\left(")).toBeInTheDocument();
  });
});
