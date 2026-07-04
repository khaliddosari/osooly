/**
 * Billing config for the /subscription page (PRD 3.10, S9). v1 has a single
 * flat plan (1 SAR/month) and a "manage billing" link, not an in-app billing
 * engine, so this stays provider-agnostic: the checkout URL comes from an env
 * var (SUBSCRIPTION_CHECKOUT_URL) pointing at whatever provider is wired for
 * the environment (a Stripe / Moyasar / Tap test-mode payment link in dev).
 * When it is unset the page shows the plan but disables the button rather than
 * linking nowhere.
 *
 * Keeping the provider out of the code means picking one at deploy time (a S10
 * hosting decision, like the sidecar and n8n hosting) never touches this file.
 */

/** The single v1 plan (PRD 3.10). */
export const PLAN = {
  name: "Osooly",
  price: 1,
  currency: "SAR",
  interval: "month",
} as const;

export interface BillingConfig {
  /** The provider checkout / manage-billing URL, or null when unconfigured. */
  checkoutUrl: string | null;
  configured: boolean;
}

/** Read the checkout URL from the environment, accepting only http(s) URLs. */
export function getBillingConfig(env: {
  SUBSCRIPTION_CHECKOUT_URL?: string;
}): BillingConfig {
  const raw = env.SUBSCRIPTION_CHECKOUT_URL?.trim();
  if (!raw) return { checkoutUrl: null, configured: false };
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return { checkoutUrl: null, configured: false };
    }
    return { checkoutUrl: url.toString(), configured: true };
  } catch {
    return { checkoutUrl: null, configured: false };
  }
}
