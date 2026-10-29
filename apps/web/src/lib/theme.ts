import { THEMES, type ThemeName } from "@joes-sim/ui";

export type ThemePreference = "system" | ThemeName;

export const THEME_STORAGE_KEY = "joes-sim:theme";
export const THEME_PREFERENCES: readonly ThemePreference[] = ["system", ...THEMES];

export interface SystemSignals {
  prefersDark: boolean;
  prefersMoreContrast: boolean;
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && (THEME_PREFERENCES as readonly string[]).includes(value);
}

/** Turns a stored preference and the device's settings into the theme to show. */
export function resolveTheme(preference: ThemePreference, system: SystemSignals): ThemeName {
  if (preference !== "system") return preference;
  if (system.prefersMoreContrast) return "high-contrast";
  return system.prefersDark ? "dark" : "light";
}

/**
 * Runs before React hydrates so the page never flashes the wrong theme.
 * It repeats resolveTheme's rules in plain JavaScript; theme.test.ts keeps the two in step.
 */
export const THEME_INIT_SCRIPT = `(function(){try{
var p=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
var t=p==="light"||p==="dark"||p==="high-contrast"?p:
matchMedia("(prefers-contrast: more)").matches?"high-contrast":
matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
document.documentElement.dataset.theme=t;
}catch(e){document.documentElement.dataset.theme="light";}})();`;
