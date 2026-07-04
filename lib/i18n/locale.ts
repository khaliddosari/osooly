/**
 * i18n locale primitives (PRD §3.9, S10 bootstrap). Pure and dependency-free so
 * both server and client code can import it. v1 ships English in full with
 * Arabic stubbed (lib/i18n/dictionary.ts) and the right-to-left flip applied on
 * `<html dir>` (lib/i18n/server.ts drives the root layout).
 *
 * lib/account/preferences.ts stores the user's chosen locale; its `Locale`
 * union mirrors this one (both "en" | "ar").
 */

export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** The cookie the account preferences form writes and the layout reads. */
export const LOCALE_COOKIE = "osooly_locale";

export type Direction = "ltr" | "rtl";

const DIRECTION: Record<Locale, Direction> = {
  en: "ltr",
  ar: "rtl",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Text direction for a locale; drives `<html dir>` and RTL layout. */
export function dir(locale: Locale): Direction {
  return DIRECTION[locale];
}
