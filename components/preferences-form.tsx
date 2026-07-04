"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { savePreferencesAction } from "@/lib/account/actions";
import {
  CURRENCIES,
  LOCALES,
  LOCALE_LABELS,
  type Locale,
  type UserPreferences,
} from "@/lib/account/preferences";
import { cn } from "@/lib/utils";

/**
 * The /account preferences form (PRD 3.9, S9): interface locale and display
 * currency, posted to the savePreferencesAction server action. AR is stubbed
 * for v1 (the option saves, full translation lands in S10), which the note
 * under the locale select makes explicit.
 */
export function PreferencesForm({
  initial,
  canUse,
}: {
  initial: UserPreferences;
  canUse: boolean;
}) {
  const [locale, setLocale] = useState<Locale>(initial.locale);
  const [displayCurrency, setDisplayCurrency] = useState(initial.displayCurrency);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const dirty =
    locale !== initial.locale || displayCurrency !== initial.displayCurrency;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("idle");
    setError(null);
    startTransition(async () => {
      const result = await savePreferencesAction({ locale, displayCurrency });
      if (result.ok) {
        setStatus("saved");
      } else {
        setStatus("error");
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="glass flex flex-col gap-5 p-6">
      <h2 className="flex items-center gap-2 text-headline-md font-bold text-on-surface">
        <Icon name="customize" className="text-primary" style={{ fontSize: 18 }} />
        Preferences
      </h2>

      <div className="grid gap-5 sm:grid-cols-2">
        <label htmlFor="pref-locale" className="flex flex-col gap-1.5">
          <span className="text-label-md text-on-surface-variant">Language</span>
          <select
            id="pref-locale"
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            disabled={!canUse}
            className={inputClass}
          >
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {LOCALE_LABELS[l]}
              </option>
            ))}
          </select>
          <span className="text-label-sm text-on-surface-variant">
            Arabic saves your choice now; full right-to-left translation lands in
            a later release.
          </span>
        </label>

        <label htmlFor="pref-currency" className="flex flex-col gap-1.5">
          <span className="text-label-md text-on-surface-variant">
            Display currency
          </span>
          <select
            id="pref-currency"
            value={displayCurrency}
            onChange={(e) => setDisplayCurrency(e.target.value)}
            disabled={!canUse}
            className={inputClass}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <span className="text-label-sm text-on-surface-variant">
            The ISO code amounts are shown in across your cards and ledger.
          </span>
        </label>
      </div>

      {status === "error" && error && (
        <p role="alert" className="text-label-md text-error">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!canUse || isPending || !dirty}
          className={cn(
            "btn-primary rounded-lg px-5 py-2.5 text-label-md",
            (!canUse || isPending || !dirty) && "cursor-not-allowed opacity-60"
          )}
        >
          <Icon
            name={isPending ? "sync" : "check"}
            className={cn(isPending && "animate-spin motion-reduce:animate-none")}
            style={{ fontSize: 15 }}
          />
          {isPending ? "Saving…" : "Save preferences"}
        </button>
        {status === "saved" && !dirty && (
          <span className="flex items-center gap-1.5 text-label-md text-success-green">
            <Icon name="check_circle" style={{ fontSize: 15 }} />
            Saved
          </span>
        )}
      </div>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-body-md text-on-surface focus:border-primary focus:outline-none disabled:opacity-60";
