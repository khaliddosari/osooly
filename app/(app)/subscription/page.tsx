import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Icon } from "@/components/icon";
import { Money } from "@/components/money";
import { auth } from "@/lib/auth";
import { getBillingConfig, PLAN } from "@/lib/billing/provider";
import { getDb } from "@/lib/db";
import {
  getMonthlyTokenUsage,
  MONTHLY_TOKEN_CAP,
  type TokenUsage,
} from "@/lib/limits/token-usage";

export const metadata: Metadata = {
  title: "Subscription - Osooly",
};

/**
 * The /subscription page (PRD 3.4 / 3.10): the single flat plan (1 SAR/month),
 * a manage-billing link to whatever provider the environment wires, and the
 * per-user monthly LLM token usage (PRD 3.9 cost controls) read from the D1
 * counter. Enforcement of the cap lands in S10; here it is displayed.
 */
export default async function SubscriptionPage() {
  const session = await auth();
  const userId = session?.user?.id;

  const { env } = await getCloudflareContext({ async: true });
  const billing = getBillingConfig(env);
  const usage = userId
    ? await getMonthlyTokenUsage(await getDb(), userId)
    : null;

  return (
    <div className="flex-1 overflow-y-auto px-gutter py-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="flex flex-col items-center gap-2 text-center">
          <h1 className="section-title text-headline-md">Subscription</h1>
          <p className="mt-4 max-w-xl text-body-md text-on-surface-variant">
            One simple plan. Everything Osooly does, for less than a coffee a
            month.
          </p>
        </header>

        {/* Plan */}
        <section className="glass flex flex-col gap-6 p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="tag">Current plan</span>
              <h2 className="mt-3 text-headline-md font-bold text-on-surface">
                {PLAN.name}
              </h2>
            </div>
            <p className="flex items-baseline gap-1.5">
              <span className="text-headline-lg font-bold text-on-surface">
                <Money value={PLAN.price} currency={PLAN.currency} />
              </span>
              <span className="text-body-md text-on-surface-variant">
                / {PLAN.interval}
              </span>
            </p>
          </div>

          <ul className="flex flex-col gap-2.5 border-t border-outline-variant pt-6">
            {PLAN_FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-body-md text-on-surface">
                <Icon name="check_circle" className="shrink-0 text-success-green" style={{ fontSize: 16 }} />
                {feature}
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-2">
            {billing.configured && billing.checkoutUrl ? (
              <a
                href={billing.checkoutUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="btn-primary self-start rounded-lg px-6 py-3 text-label-md"
              >
                <Icon name="subscription" style={{ fontSize: 16 }} />
                Manage billing
              </a>
            ) : (
              <>
                <button
                  type="button"
                  disabled
                  className="btn-primary cursor-not-allowed self-start rounded-lg px-6 py-3 text-label-md opacity-60"
                >
                  <Icon name="subscription" style={{ fontSize: 16 }} />
                  Manage billing
                </button>
                <p className="text-label-sm text-on-surface-variant">
                  Billing is not configured in this environment. Set{" "}
                  <code className="font-mono text-primary">SUBSCRIPTION_CHECKOUT_URL</code>{" "}
                  to a provider checkout link to enable it.
                </p>
              </>
            )}
          </div>
        </section>

        {/* Usage */}
        <section className="glass flex flex-col gap-5 p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-headline-md font-bold text-on-surface">
              <Icon name="insights" className="text-primary" style={{ fontSize: 18 }} />
              AI usage this month
            </h2>
            {usage && (
              <span className="font-mono text-label-md text-on-surface-variant">
                {usage.period}
              </span>
            )}
          </div>

          {usage ? (
            <UsageMeter usage={usage} />
          ) : (
            <p className="text-body-md text-on-surface-variant">
              Sign in to see your monthly AI token usage.
            </p>
          )}

          <p className="text-label-sm text-on-surface-variant">
            Your plan includes {MONTHLY_TOKEN_CAP.toLocaleString("en-US")} LLM
            tokens per month across all agent runs. The counter resets on the
            first of each month.
          </p>
        </section>
      </div>
    </div>
  );
}

const PLAN_FEATURES = [
  "Unlimited cards and dashboard pages",
  "Agent recommendations across every asset class",
  "Price alerts delivered through your channels",
  "Namtheg AutoML runs",
];

function UsageMeter({ usage }: { usage: TokenUsage }) {
  const percent = Math.round(usage.fraction * 100);
  const near = usage.fraction >= 0.9;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-body-md text-on-surface">
          <span className="font-semibold">{usage.used.toLocaleString("en-US")}</span>{" "}
          <span className="text-on-surface-variant">
            / {usage.cap.toLocaleString("en-US")} tokens
          </span>
        </span>
        <span className={near ? "text-label-md text-warning-orange" : "text-label-md text-on-surface-variant"}>
          {percent}% used
        </span>
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-surface-container"
        role="progressbar"
        aria-valuenow={usage.used}
        aria-valuemin={0}
        aria-valuemax={usage.cap}
        aria-label="Monthly token usage"
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.max(usage.fraction * 100, usage.used > 0 ? 2 : 0)}%`,
            background: "var(--accent-gradient)",
          }}
        />
      </div>
      <p className="text-label-sm text-on-surface-variant">
        {usage.remaining.toLocaleString("en-US")} tokens remaining
      </p>
    </div>
  );
}
