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

// Fase 10 (auditoría Fase 0 v2, port de precision-lab-lite): las teclas
// del menú "Stat" que usan \mathrm{...} (mean/median/mode/stdev/var/mad/
// sort/mod/lcm/nCr/nPr) llegaban al backend deletreadas como variables
// sueltas de una letra (ej. "m e a n(1,2,3)"), no como el nombre de
// función esperado — convertLatexToAsciiMath no colapsa \mathrm/
// \operatorname en un solo identificador (confirmado probando la
// librería real, no asumido).
describe("latexToBackendSyntax — Fase 10 (funciones de estadística)", () => {
  it("colapsa \\mathrm{nombre} de vuelta a un identificador, para las 11 teclas afectadas", () => {
    const cases: [string, string][] = [
      ["\\mathrm{mean}\\left(1,2,3\\right)", "mean(1,2,3)"],
      ["\\mathrm{median}\\left(1,2,3,4\\right)", "median(1,2,3,4)"],
      ["\\mathrm{mode}\\left(1,2,2,3\\right)", "mode(1,2,2,3)"],
      ["\\mathrm{stdev}\\left(2,4,6\\right)", "stdev(2,4,6)"],
      ["\\mathrm{var}\\left(2,4,6\\right)", "var(2,4,6)"],
      ["\\mathrm{mad}\\left(1,2,3\\right)", "mad(1,2,3)"],
      ["\\mathrm{sort}\\left(3,1,2\\right)", "sort(3,1,2)"],
      ["\\mathrm{mod}\\left(7,3\\right)", "mod(7,3)"],
      ["\\mathrm{lcm}\\left(4,6\\right)", "lcm(4,6)"],
      ["\\mathrm{nCr}\\left(5,2\\right)", "nCr(5,2)"],
      ["\\mathrm{nPr}\\left(5,2\\right)", "nPr(5,2)"],
    ];
    for (const [latex, expected] of cases) {
      expect(latexToBackendSyntax(latex)).toBe(expected);
    }
  });

  it("\\min/\\max/\\gcd ya convertían razonablemente (con un espacio antes del paréntesis, tolerado por el backend)", () => {
    expect(latexToBackendSyntax("\\min\\left(1,2,3\\right)")).toBe("min (1,2,3)");
    expect(latexToBackendSyntax("\\max\\left(1,2,3\\right)")).toBe("max (1,2,3)");
    expect(latexToBackendSyntax("\\gcd\\left(4,6\\right)")).toBe("gcd (4,6)");
  });

  it("no colapsa multiplicación implícita legítima entre variables de una letra", () => {
    expect(latexToBackendSyntax("xyz")).toBe("x y z");
  });
});
