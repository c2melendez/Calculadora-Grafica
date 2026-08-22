/**
 * src/components/formatNumber.ts — formato de números (spec, sección 11):
 * notación científica para `result_approx` extremo.
 */

const SCIENTIFIC_THRESHOLD_HIGH = 1e6;
const SCIENTIFIC_THRESHOLD_LOW = 1e-6;

export function formatResultApprox(value: number): string {
  if (value === 0) return "0";
  const magnitude = Math.abs(value);
  if (magnitude >= SCIENTIFIC_THRESHOLD_HIGH || magnitude < SCIENTIFIC_THRESHOLD_LOW) {
    return value.toExponential(6);
  }
  return String(value);
}
