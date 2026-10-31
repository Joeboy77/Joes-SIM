"use client";

import { useCallback, useEffect, useId, useSyncExternalStore } from "react";
import type { MessageKey } from "./messages/en";
import {
  LOCALES,
  LOCALE_STORAGE_KEY,
  coverage,
  isLocaleCode,
  localeOf,
  preferredLocale,
  translate,
  type LocaleCode,
} from "./locales";

const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Below this share of translated text, a language is only used when chosen by hand. */
const AUTO_THRESHOLD = 0.9;

function readLocale(): LocaleCode {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocaleCode(stored)) return stored;
  } catch {
    // Storage can be unavailable; fall through.
  }
  const preferred = preferredLocale(navigator.languages ?? []);
  return coverage(localeOf(preferred)) >= AUTO_THRESHOLD ? preferred : "en";
}

export function setLocale(code: LocaleCode) {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, code);
  } catch {
    // The choice still applies for this visit.
  }
  document.documentElement.lang = code;
  document.documentElement.dir = localeOf(code).dir;
  listeners.forEach((l) => l());
}

export function useLocale(): LocaleCode {
  return useSyncExternalStore(subscribe, readLocale, () => "en");
}

/** `t("nav.learn")` in the learner's language, falling back to English. */
export function useT() {
  const code = useLocale();
  return useCallback(
    (key: MessageKey, values?: Readonly<Record<string, string | number>>) =>
      translate(code, key, values),
    [code],
  );
}

/** Keeps the page's language and text direction in step with the chosen language. */
export function LocaleRoot() {
  const code = useLocale();
  useEffect(() => {
    document.documentElement.lang = code;
    document.documentElement.dir = localeOf(code).dir;
  }, [code]);
  return null;
}

export function LanguageSwitcher() {
  const id = useId();
  const code = useLocale();
  const t = useT();
  return (
    <div className="flex items-center gap-2 text-sm">
      <label htmlFor={id} className="text-muted">
        {t("language.label")}
      </label>
      <select
        id={id}
        value={code}
        onChange={(e) => isLocaleCode(e.target.value) && setLocale(e.target.value)}
        className="rounded-sm border border-border-strong bg-surface px-2 py-1 text-text"
      >
        {LOCALES.map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>
            {coverage(l) < 1 ? t("language.partial", { language: l.name }) : l.name}
          </option>
        ))}
      </select>
    </div>
  );
}
