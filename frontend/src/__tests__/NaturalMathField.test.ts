import { describe, expect, it } from "vitest";

import { latexToBackendSyntax } from "../components/NaturalMathField";

describe("latexToBackendSyntax", () => {
  it("convierte una fracción simple a división con paréntesis", () => {
    expect(latexToBackendSyntax("\\frac{1}{2}")).toBe("(1)/(2)");
  });

  it("mantiene exponentes con ^ (el backend los soporta vía convert_xor)", () => {
    expect(latexToBackendSyntax("x^2")).toBe("x^2");
  });

  it("convierte raíces cuadradas a sqrt()", () => {
    expect(latexToBackendSyntax("\\sqrt{9}")).toBe("sqrt(9)");
  });

  it("reescribe la raíz n-ésima a potencia fraccionaria (el backend no tiene root())", () => {
    expect(latexToBackendSyntax("\\sqrt[3]{8}")).toBe("(8)**(1/(3))");
  });

  it("reescribe una raíz n-ésima anidada dentro de otra expresión", () => {
    expect(latexToBackendSyntax("1+\\sqrt[3]{8}")).toBe("1+(8)**(1/(3))");
  });

  it("convierte funciones trigonométricas e implícitas", () => {
    expect(latexToBackendSyntax("\\sin\\left(x\\right)")).toBe("sin (x)");
  });

  it("preserva el signo = para ecuaciones", () => {
    expect(latexToBackendSyntax("x=\\frac{1}{2}")).toBe("x=(1)/(2)");
  });

  it("convierte pi y multiplicación implícita", () => {
    expect(latexToBackendSyntax("2\\pi")).toBe("2pi");
  });

  it("convierte × a * explícito", () => {
    expect(latexToBackendSyntax("3\\times4")).toBe("3 * 4");
  });

  it("una expresión vacía produce una cadena vacía", () => {
    expect(latexToBackendSyntax("")).toBe("");
    expect(latexToBackendSyntax("   ")).toBe("");
  });
});
