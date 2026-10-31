import { describe, expect, it } from "vitest";
import { LOCALES, coverage, isLocaleCode, localeOf, preferredLocale, translate } from "./locales";
import { en } from "./messages/en";

describe("translation", () => {
  it("has English complete and every planned language set up", () => {
    expect(coverage(localeOf("en"))).toBe(1);
    expect(LOCALES.map((l) => l.code)).toEqual(["en", "fr", "es", "pt", "ar", "sw", "tw"]);
    expect(localeOf("ar").dir).toBe("rtl");
    expect(LOCALES.filter((l) => l.dir === "rtl").map((l) => l.code)).toEqual(["ar"]);
  });

  it("falls back to English for anything not translated yet", () => {
    expect(translate("fr", "nav.learn")).toBe(en["nav.learn"]);
    expect(translate("en", "language.partial", { language: "Twi" })).toBe(
      "Twi (partly translated)",
    );
    expect(translate("en", "language.partial")).toBe("{language} (partly translated)");
  });

  it("uses a translation when there is one", () => {
    const fr = localeOf("fr");
    (fr.messages as Record<string, string>)["nav.learn"] = "Apprendre";
    expect(translate("fr", "nav.learn")).toBe("Apprendre");
    expect(coverage(fr)).toBeGreaterThan(0);
    delete (fr.messages as Record<string, string>)["nav.learn"];
  });

  it("picks the browser's preferred language when Joe's SIM has it", () => {
    expect(preferredLocale(["de-DE", "fr-FR"])).toBe("fr");
    expect(preferredLocale(["ak-GH"])).toBe("tw");
    expect(preferredLocale(["de"])).toBe("en");
    expect(isLocaleCode("ar")).toBe(true);
    expect(isLocaleCode("de")).toBe(false);
  });
});
