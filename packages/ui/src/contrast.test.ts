import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio, parseHex, parseThemes } from "./contrast";

const css = readFileSync(join(import.meta.dirname, "styles/tokens.css"), "utf8");
const themes = parseThemes(css);

// WCAG 2.2 AA: 4.5 for body text, 3 for large text and UI parts (1.4.3, 1.4.11).
// The high-contrast theme must meet AAA (7) for text.
const TEXT = ["text", "text-muted", "accent", "read", "write", "branch", "danger", "success"];
const UI = ["border-strong", "focus"];

function token(theme: Record<string, string>, key: string): string {
  const value = theme[key];
  if (value === undefined) throw new Error(`Missing token --sim-color-${key}`);
  return value;
}
const BACKGROUNDS = ["bg", "surface", "surface-2"];

describe("contrast helpers", () => {
  it("matches known WCAG values", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
    expect(contrastRatio("#ffffff", "#ffffff")).toBe(1);
  });

  it("rejects malformed colours", () => {
    expect(() => parseHex("red")).toThrow();
    expect(parseHex("#ff8000")).toEqual([255, 128, 0]);
  });
});

describe("theme tokens", () => {
  it("defines light, dark and high-contrast themes with the same tokens", () => {
    expect(Object.keys(themes).sort()).toEqual(["dark", "high-contrast", "light"]);
    const keys = Object.values(themes).map((t) => Object.keys(t).sort().join(","));
    expect(new Set(keys).size).toBe(1);
  });

  for (const [name, t] of Object.entries(themes)) {
    describe(name, () => {
      const textMin = name === "high-contrast" ? 7 : 4.5;

      for (const bg of BACKGROUNDS) {
        for (const fg of TEXT) {
          it(`${fg} on ${bg} is at least ${textMin}:1`, () => {
            expect(contrastRatio(token(t, fg), token(t, bg))).toBeGreaterThanOrEqual(textMin);
          });
        }
        for (const fg of UI) {
          it(`${fg} on ${bg} is at least 3:1`, () => {
            expect(contrastRatio(token(t, fg), token(t, bg))).toBeGreaterThanOrEqual(3);
          });
        }
      }

      it(`on-accent text on accent is at least ${textMin}:1`, () => {
        expect(contrastRatio(token(t, "on-accent"), token(t, "accent"))).toBeGreaterThanOrEqual(
          textMin,
        );
      });
    });
  }
});
