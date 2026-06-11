import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { D1Adapter } from "@auth/d1-adapter";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * NextAuth v5 with Google sign-in and sessions stored in D1 (PRD §3.8).
 *
 * The config is built lazily per request — the D1 binding and secrets only
 * exist inside a request's Cloudflare context, so they can't be read at
 * module load.
 */
export const { handlers, auth, signIn, signOut } = NextAuth(async () => {
  const { env } = await getCloudflareContext({ async: true });
  return {
    adapter: D1Adapter(env.DB),
    session: { strategy: "database" },
    providers: [
      Google({
        clientId: env.AUTH_GOOGLE_ID,
        clientSecret: env.AUTH_GOOGLE_SECRET,
      }),
    ],
    secret: env.AUTH_SECRET,
    // We serve from Cloudflare, not Vercel — the Host header is already
    // proxy-validated, so tell NextAuth to trust it.
    trustHost: true,
  };
});
