/**
 * Number views (brief, 7.11): any value in decimal, binary, hexadecimal and two's complement,
 * to link the decimal LMC to how real hardware stores numbers.
 */
import { getDialect } from "../dialects/dialects";
import type { DialectId } from "../dialects/types";

export interface NumberViews {
  readonly decimal: string;
  /** Plain binary, with a minus sign for negative values. Grouped in fours. */
  readonly binary: string;
  readonly hex: string;
  /** The bit pattern a computer of `bits` bits would store. */
  readonly twosComplement: string;
  readonly bits: number;
}

/** Bits needed to hold every value of the dialect: 10 for 0 to 999, 11 for -999 to 999. */
export function bitsFor(dialect: DialectId): number {
  const d = getDialect(dialect);
  return d.minValue < 0 ? 11 : 10;
}

const group = (bits: string) => bits.replace(/\B(?=(\d{4})+$)/g, " ");

export function numberViews(value: number, dialect: DialectId): NumberViews {
  const bits = bitsFor(dialect);
  const magnitude = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const pattern = ((value % 2 ** bits) + 2 ** bits) % 2 ** bits;
  return {
    decimal: String(value),
    binary: sign + group(magnitude.toString(2)),
    hex: `${sign}${magnitude.toString(16).toUpperCase()}`,
    twosComplement: group(pattern.toString(2).padStart(bits, "0")),
    bits,
  };
}
