/** WCAG 2.2 contrast helpers, used to test the design tokens. */

export type Rgb = readonly [number, number, number];

export function parseHex(hex: string): Rgb {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match?.[1]) throw new Error(`Expected a 6-digit hex colour, got "${hex}"`);
  const n = Number.parseInt(match[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(parseHex(a));
  const lb = relativeLuminance(parseHex(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Reads `--sim-color-*` tokens for each `[data-theme="..."]` block in a CSS file. */
export function parseThemes(css: string): Record<string, Record<string, string>> {
  const themes: Record<string, Record<string, string>> = {};
  const block = /\[data-theme="([\w-]+)"\]\s*\{([^}]*)\}/g;
  for (const [, name, body] of css.matchAll(block)) {
    if (!name || body === undefined) continue;
    const tokens: Record<string, string> = {};
    for (const [, key, value] of body.matchAll(/--sim-color-([\w-]+):\s*([^;]+);/g)) {
      if (key && value) tokens[key] = value.trim();
    }
    themes[name] = tokens;
  }
  return themes;
}
