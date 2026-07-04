"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { LOCALE_COOKIE } from "@/lib/i18n/locale";
import { parsePreferences } from "./preferences";
import { savePreferences } from "./store";

// One year; the locale cookie is a UI preference, not a session token.
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Server action behind the /account preferences form (S9). Parses the
 * submitted values through parsePreferences() (so a malformed field falls back
 * to its default rather than corrupting the row) and upserts them, scoped to
 * the signed-in user.
 */
export async function savePreferencesAction(input: {
  locale: unknown;
  displayCurrency: unknown;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Sign in to save preferences." };

  const prefs = parsePreferences(input);
  await savePreferences(await getDb(), userId, prefs);

  // Mirror the locale into the cookie the root layout reads, so the interface
  // language and the RTL flip follow the saved preference on the next render.
  (await cookies()).set(LOCALE_COOKIE, prefs.locale, {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
  });

  revalidatePath("/account");
  return { ok: true };
}
