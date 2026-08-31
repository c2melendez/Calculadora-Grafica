import { describe, expect, it } from "vitest";
import { splitSystemLatex } from "../components/systemSplit";

describe("splitSystemLatex (Fase 1 — fusión de modos, proyecto con backend Python)", () => {
  it("separa un sistema de 2 ecuaciones en renglones individuales", () => {
    const latex = "\\begin{cases}2x+y=5\\\\x-y=1\\end{cases}";
    expect(splitSystemLatex(latex)).toEqual(["2x+y=5", "x-y=1"]);
  });

  it("separa un sistema de 3 ecuaciones", () => {
    const latex = "\\begin{cases}x+y+z=6\\\\x-y=0\\\\z=3\\end{cases}";
    expect(splitSystemLatex(latex)).toEqual(["x+y+z=6", "x-y=0", "z=3"]);
  });

  it("recorta espacios alrededor de cada renglón", () => {
    const latex = "\\begin{cases} 2x+y=5 \\\\ x-y=1 \\end{cases}";
    expect(splitSystemLatex(latex)).toEqual(["2x+y=5", "x-y=1"]);
  });

  it("devuelve null si no hay entorno cases", () => {
    expect(splitSystemLatex("2x+3=7")).toBeNull();
  });

  it("devuelve null si el cases tiene un único renglón no vacío (plantilla recién insertada, sin completar)", () => {
    expect(splitSystemLatex("\\begin{cases}2x+y=5\\\\\\end{cases}")).toBeNull();
    expect(splitSystemLatex("\\begin{cases}\\end{cases}")).toBeNull();
  });

  it("ignora texto fuera del entorno cases", () => {
    const latex = "algo\\begin{cases}x=1\\\\y=2\\end{cases}más";
    expect(splitSystemLatex(latex)).toEqual(["x=1", "y=2"]);
  });
});
