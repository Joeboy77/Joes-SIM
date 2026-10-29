"use client";

import { useCallback, useEffect, useId, useSyncExternalStore } from "react";
import {
  THEME_STORAGE_KEY,
  isThemePreference,
  resolveTheme,
  type ThemePreference,
} from "@/lib/theme";

const LABELS: Record<ThemePreference, string> = {
  system: "Match device",
  light: "Light",
  dark: "Dark",
  "high-contrast": "High contrast",
};

const listeners = new Set<() => void>();

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function applyTheme(preference: ThemePreference) {
  document.documentElement.dataset.theme = resolveTheme(preference, {
    prefersDark: matchMedia("(prefers-color-scheme: dark)").matches,
    prefersMoreContrast: matchMedia("(prefers-contrast: more)").matches,
  });
}

export function ThemeSwitcher() {
  const id = useId();
  const preference = useSyncExternalStore(subscribe, readPreference, () => "system");

  const choose = useCallback((next: ThemePreference) => {
    try {
      if (next === "system") localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage can be unavailable (private mode); the theme still applies for this visit.
    }
    applyTheme(next);
    listeners.forEach((listener) => listener());
  }, []);

  // When following the device, react to the device's settings changing.
  useEffect(() => {
    if (preference !== "system") return;
    const queries = [
      matchMedia("(prefers-color-scheme: dark)"),
      matchMedia("(prefers-contrast: more)"),
    ];
    const update = () => applyTheme("system");
    queries.forEach((q) => q.addEventListener("change", update));
    return () => queries.forEach((q) => q.removeEventListener("change", update));
  }, [preference]);

  return (
    <div className="flex items-center gap-2 text-sm">
      <label htmlFor={id} className="text-muted">
        Theme
      </label>
      <select
        id={id}
        value={preference}
        onChange={(event) => {
          if (isThemePreference(event.target.value)) choose(event.target.value);
        }}
        className="rounded-sm border border-border-strong bg-surface px-2 py-1 text-text"
      >
        {(Object.keys(LABELS) as ThemePreference[]).map((value) => (
          <option key={value} value={value}>
            {LABELS[value]}
          </option>
        ))}
      </select>
    </div>
  );
}
