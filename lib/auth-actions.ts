"use server";

import { signIn, signOut } from "@/lib/auth";

/**
 * Server actions for the Google sign-in / sign-out buttons (PRD 3.8). NextAuth's
 * `signIn` / `signOut` must run on the server (they set the session cookie), so
 * these thin wrappers are what the /account page's forms post to. They live
 * outside lib/auth.ts because that module's `handlers` export is consumed by
 * the route handler, and marking it "use server" would change its semantics.
 */

export async function signInWithGoogle(): Promise<void> {
  await signIn("google", { redirectTo: "/dashboard" });
}

export async function signOutOfOsooly(): Promise<void> {
  await signOut({ redirectTo: "/dashboard" });
}
