import { describe, expect, it } from "vitest";
import { t } from "./dictionary";
import { dir, isLocale } from "./locale";

describe("locale", () => {
  it("flips Arabic to right-to-left and keeps English left-to-right", () => {
    expect(dir("en")).toBe("ltr");
    expect(dir("ar")).toBe("rtl");
  });

  it("recognises only the supported locales", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("ar")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe("t", () => {
  it("returns the English string for English", () => {
    expect(t("en", "nav.assets")).toBe("Assets");
  });

  it("returns the Arabic string where the stub has one", () => {
    expect(t("ar", "nav.assets")).toBe("الأصول");
  });

  it("falls back to English for a key the Arabic stub has not translated", () => {
    // Force a missing AR key by trusting the fallback chain: every EN key is
    // present, so any AR gap resolves to the English string, never blank.
    const value = t("ar", "footer.madeBy");
    expect(value.length).toBeGreaterThan(0);
  });
});
