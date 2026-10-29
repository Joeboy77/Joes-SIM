import { describe, expect, it } from "vitest";
import {
  THEME_INIT_SCRIPT,
  THEME_PREFERENCES,
  THEME_STORAGE_KEY,
  isThemePreference,
  resolveTheme,
  type SystemSignals,
} from "./theme";

const LIGHT: SystemSignals = { prefersDark: false, prefersMoreContrast: false };
const DARK: SystemSignals = { prefersDark: true, prefersMoreContrast: false };
const MORE_CONTRAST: SystemSignals = { prefersDark: false, prefersMoreContrast: true };
const DARK_MORE_CONTRAST: SystemSignals = { prefersDark: true, prefersMoreContrast: true };
const SIGNALS = [LIGHT, DARK, MORE_CONTRAST, DARK_MORE_CONTRAST];

function runInitScript(stored: string | null, system: SystemSignals): string | undefined {
  const dataset: Record<string, string> = {};
  const env = {
    localStorage: { getItem: (key: string) => (key === THEME_STORAGE_KEY ? stored : null) },
    matchMedia: (query: string) => ({
      matches: query.includes("contrast") ? system.prefersMoreContrast : system.prefersDark,
    }),
    document: { documentElement: { dataset } },
  };
  new Function("localStorage", "matchMedia", "document", THEME_INIT_SCRIPT)(
    env.localStorage,
    env.matchMedia,
    env.document,
  );
  return dataset["theme"];
}

describe("resolveTheme", () => {
  it("uses an explicit choice regardless of device settings", () => {
    for (const system of SIGNALS) {
      expect(resolveTheme("dark", system)).toBe("dark");
      expect(resolveTheme("light", system)).toBe("light");
      expect(resolveTheme("high-contrast", system)).toBe("high-contrast");
    }
  });

  it("follows the device when set to system, with more contrast winning", () => {
    expect(resolveTheme("system", LIGHT)).toBe("light");
    expect(resolveTheme("system", DARK)).toBe("dark");
    expect(resolveTheme("system", MORE_CONTRAST)).toBe("high-contrast");
    expect(resolveTheme("system", DARK_MORE_CONTRAST)).toBe("high-contrast");
  });

  it("recognises valid preferences only", () => {
    expect(isThemePreference("dark")).toBe(true);
    expect(isThemePreference("sepia")).toBe(false);
    expect(isThemePreference(null)).toBe(false);
  });
});

describe("THEME_INIT_SCRIPT", () => {
  it("agrees with resolveTheme for every preference and device setting", () => {
    for (const preference of THEME_PREFERENCES) {
      for (const system of SIGNALS) {
        const stored = preference === "system" ? null : preference;
        expect(runInitScript(stored, system)).toBe(resolveTheme(preference, system));
      }
    }
  });

  it("ignores a corrupted stored value", () => {
    expect(runInitScript("purple", DARK)).toBe("dark");
  });
});
