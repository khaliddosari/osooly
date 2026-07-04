"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { parsePreferences } from "./preferences";
import { savePreferences } from "./store";

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
  revalidatePath("/account");
  return { ok: true };
}
