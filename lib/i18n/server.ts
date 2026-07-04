import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./locale";

/**
 * Server-side locale resolution (S10). The active locale is the value of the
 * osooly_locale cookie (written by the account preferences form), defaulting to
 * English. Read in the root layout to set `<html lang / dir>` and passed down to
 * the chrome so the whole tree, including the RTL flip, follows one source.
 */
export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
