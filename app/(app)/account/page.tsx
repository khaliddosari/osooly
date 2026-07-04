import type { Metadata } from "next";
import { Icon } from "@/components/icon";
import { PreferencesForm } from "@/components/preferences-form";
import { getPreferences } from "@/lib/account/store";
import { DEFAULT_PREFERENCES } from "@/lib/account/preferences";
import { signInWithGoogle, signOutOfOsooly } from "@/lib/auth-actions";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const metadata: Metadata = {
  title: "Account - Osooly",
};

/**
 * The /account page (PRD 3.4): the Google-linked identity (read-only, the
 * profile comes from the OAuth session) plus editable preferences, and the
 * sign-in / sign-out control. Signed-out visitors get the Google sign-in card.
 */
export default async function AccountPage() {
  const session = await auth();
  const user = session?.user;

  if (!user?.id) {
    return (
      <div className="flex flex-1 items-center justify-center px-gutter py-section-gap">
        <div className="glass flex max-w-md flex-col items-center gap-5 px-10 py-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-purple-tint">
            <Icon name="account" className="text-primary" style={{ fontSize: 22 }} />
          </span>
          <div className="flex flex-col gap-2">
            <h1 className="text-headline-md font-bold text-on-surface">
              Sign in to Osooly
            </h1>
            <p className="text-body-md text-on-surface-variant">
              Connect your Google account to build your dashboard, track
              holdings, and get agent recommendations.
            </p>
          </div>
          <form action={signInWithGoogle}>
            <button type="submit" className="btn-primary rounded-lg px-6 py-3 text-label-md">
              <Icon name="account" style={{ fontSize: 16 }} />
              Continue with Google
            </button>
          </form>
        </div>
      </div>
    );
  }

  const prefs = user.id
    ? await getPreferences(await getDb(), user.id)
    : DEFAULT_PREFERENCES;

  return (
    <div className="flex-1 overflow-y-auto px-gutter py-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="flex flex-col items-center gap-2 text-center">
          <h1 className="section-title text-headline-md">Account</h1>
          <p className="mt-4 max-w-xl text-body-md text-on-surface-variant">
            Your Google-linked identity and interface preferences.
          </p>
        </header>

        {/* Identity (read-only, from the OAuth session) */}
        <section className="glass flex flex-col gap-5 p-6">
          <h2 className="flex items-center gap-2 text-headline-md font-bold text-on-surface">
            <Icon name="account" className="text-primary" style={{ fontSize: 18 }} />
            Profile
          </h2>
          <div className="flex items-center gap-4">
            <Avatar name={user.name} image={user.image} />
            <div className="min-w-0">
              <p className="truncate text-body-md font-semibold text-on-surface">
                {user.name ?? "Osooly user"}
              </p>
              <p className="truncate text-label-md text-on-surface-variant">
                {user.email ?? "No email on file"}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-label-sm text-on-surface-variant">
                <Icon name="check_circle" className="text-success-green" style={{ fontSize: 12 }} />
                Linked with Google
              </p>
            </div>
          </div>
        </section>

        <PreferencesForm initial={prefs} canUse />

        {/* Session */}
        <section className="glass flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <h2 className="text-body-md font-semibold text-on-surface">Session</h2>
            <p className="text-label-md text-on-surface-variant">
              Sign out on this device. Your data stays in your account.
            </p>
          </div>
          <form action={signOutOfOsooly}>
            <button type="submit" className="btn-glass rounded-lg px-5 py-2.5 text-label-md">
              <Icon name="arrow_outward" style={{ fontSize: 15 }} />
              Sign out
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

function Avatar({
  name,
  image,
}: {
  name?: string | null;
  image?: string | null;
}) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        width={56}
        height={56}
        referrerPolicy="no-referrer"
        className="h-14 w-14 shrink-0 rounded-full border border-outline-variant object-cover"
      />
    );
  }
  const initial = (name ?? "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-surface-purple-tint text-headline-md font-bold text-primary">
      {initial}
    </span>
  );
}
