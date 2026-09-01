// Fase A (spec UX estilo ClassCalc, §3.3): renderiza notación matemática
// real en las teclas — nunca texto plano aproximado ("x^-1", "a/b" como
// texto). Un solo componente para todas las teclas evita reescribir el
// HTML de superíndice/subíndice/fracción/radical en cada lugar.

export type Glyph =
  | string
  | { sup: string; base?: string }
  | { sub: string; base: string }
  | { sub: string; sup: string; base: string }
  | { frac: [string, string] }
  | { sqrt: string; index?: string }
  | { italic: string };

export function KeyGlyph({ glyph, className = "" }: { glyph: Glyph; className?: string }) {
  if (typeof glyph === "string") {
    return <span className={className}>{glyph}</span>;
  }

  if ("frac" in glyph) {
    const [num, den] = glyph.frac;
    return (
      <span className={`inline-flex flex-col items-center leading-none ${className}`}>
        <span>{num}</span>
        <span className="my-0.5 h-px w-3 bg-current" />
        <span>{den}</span>
      </span>
    );
  }

  if ("sqrt" in glyph) {
    return (
      <span className={`relative inline-flex items-center ${className}`}>
        {glyph.index && (
          <span className="absolute -left-0.5 -top-1.5 text-[0.55em]">{glyph.index}</span>
        )}
        <span className={glyph.index ? "ml-1.5" : ""}>√</span>
        <span className="border-t border-current pl-0.5">{glyph.sqrt}</span>
      </span>
    );
  }

  if ("sub" in glyph && "sup" in glyph) {
    return (
      <span className={`inline-flex items-center ${className}`}>
        <span>{glyph.base}</span>
        <span className="ml-0.5 inline-flex flex-col justify-center leading-none">
          <span className="text-[0.6em]">{glyph.sup}</span>
          <span className="text-[0.6em]">{glyph.sub}</span>
        </span>
      </span>
    );
  }

  if ("sub" in glyph) {
    return (
      <span className={`inline-flex items-baseline ${className}`}>
        <span>{glyph.base}</span>
        <span className="relative top-[0.3em] text-[0.6em]">{glyph.sub}</span>
      </span>
    );
  }

  if ("sup" in glyph) {
    return (
      <span className={`inline-flex items-baseline ${className}`}>
        {glyph.base && <span>{glyph.base}</span>}
        <span className="relative top-[-0.4em] text-[0.6em]">{glyph.sup}</span>
      </span>
    );
  }

  // "italic" en glyph
  return <span className={`italic ${className}`}>{glyph.italic}</span>;
}

/** Caja vacía □ — placeholder visual para plantillas (spec §3.2). */
export const BOX = "□";
