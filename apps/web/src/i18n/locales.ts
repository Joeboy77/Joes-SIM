import { ar } from "./messages/ar";
import { en, type Messages } from "./messages/en";
import { es } from "./messages/es";
import { fr } from "./messages/fr";
import { pt } from "./messages/pt";
import { sw } from "./messages/sw";
import { tw } from "./messages/tw";

export interface Locale {
  readonly code: "en" | "fr" | "es" | "pt" | "ar" | "sw" | "tw";
  /** The language's name in itself. */
  readonly name: string;
  readonly dir: "ltr" | "rtl";
  readonly messages: Partial<Messages>;
}

export const LOCALES: readonly Locale[] = [
  { code: "en", name: "English", dir: "ltr", messages: en },
  { code: "fr", name: "Français", dir: "ltr", messages: fr },
  { code: "es", name: "Español", dir: "ltr", messages: es },
  { code: "pt", name: "Português", dir: "ltr", messages: pt },
  { code: "ar", name: "العربية", dir: "rtl", messages: ar },
  { code: "sw", name: "Kiswahili", dir: "ltr", messages: sw },
  { code: "tw", name: "Twi", dir: "ltr", messages: tw },
];

export type LocaleCode = Locale["code"];
export const LOCALE_STORAGE_KEY = "joes-sim:locale";

export const isLocaleCode = (v: unknown): v is LocaleCode =>
  typeof v === "string" && LOCALES.some((l) => l.code === v);

export const localeOf = (code: LocaleCode): Locale =>
  LOCALES.find((l) => l.code === code) ?? (LOCALES[0] as Locale);

/** How much of a language is translated, from 0 to 1. */
export function coverage(locale: Locale): number {
  const keys = Object.keys(en);
  return keys.filter((k) => k in locale.messages).length / keys.length;
}

/** The text for a key: the language's own, else English. `{name}` placeholders are filled in. */
export function translate(
  code: LocaleCode,
  key: keyof Messages,
  values: Readonly<Record<string, string | number>> = {},
): string {
  const text = localeOf(code).messages[key] ?? en[key];
  return text.replace(/\{(\w+)\}/g, (m, name: string) =>
    name in values ? String(values[name]) : m,
  );
}

/** The first of the browser's preferred languages that Joe's SIM has, else English. */
export function preferredLocale(languages: readonly string[]): LocaleCode {
  for (const lang of languages) {
    const base = lang.toLowerCase().split("-")[0];
    if (isLocaleCode(base)) return base;
    if (base === "ak" || base === "twi") return "tw";
  }
  return "en";
}

/** Runs before the page paints, so the language and text direction never flash. */
export const LOCALE_INIT_SCRIPT = `(function(){try{var c=localStorage.getItem(${JSON.stringify(LOCALE_STORAGE_KEY)});var r=${JSON.stringify(LOCALES.filter((l) => l.dir === "rtl").map((l) => l.code))};if(c){document.documentElement.lang=c;document.documentElement.dir=r.indexOf(c)>=0?"rtl":"ltr";}}catch(e){}})();`;
