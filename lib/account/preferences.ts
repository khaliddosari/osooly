/**
 * User-preference value model (PRD 3.9, the /account page in S9): the pure,
 * runtime-only core shared by the store (D1 shape) and the preferences form
 * (labels + options). No D1, no server-only, no React, so it stays testable.
 *
 * v1 exposes the two preferences the PRD names: interface locale (EN full, AR
 * stubbed) and the ISO code money is displayed in. Dark-only and RTL-on-<html
 * dir> are design-system rules, not user toggles, so they are absent by design.
 */

export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  ar: "العربية (Arabic)",
};

/** Common home currencies offered in the select; any 3-letter ISO code is
 * accepted on save so the list is a convenience, not a constraint. */
export const CURRENCIES = [
  "SAR",
  "USD",
  "AED",
  "EUR",
  "GBP",
  "KWD",
  "BHD",
  "QAR",
  "OMR",
] as const;

export interface UserPreferences {
  locale: Locale;
  displayCurrency: string;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  locale: "en",
  displayCurrency: "SAR",
};

function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Parse untrusted preference input (form body / stored row), filling any
 * missing or malformed field from DEFAULT_PREFERENCES so a partial write can
 * never corrupt the row. Currency is normalised to an upper-case 3-letter ISO
 * code, falling back to the default otherwise.
 */
export function parsePreferences(raw: unknown): UserPreferences {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PREFERENCES };
  const p = raw as Record<string, unknown>;

  const locale = isLocale(p.locale) ? p.locale : DEFAULT_PREFERENCES.locale;

  const currencyRaw =
    typeof p.displayCurrency === "string" ? p.displayCurrency.trim().toUpperCase() : "";
  const displayCurrency = /^[A-Z]{3}$/.test(currencyRaw)
    ? currencyRaw
    : DEFAULT_PREFERENCES.displayCurrency;

  return { locale, displayCurrency };
}
