/**
 * UI string dictionary (PRD §3.9, S10). English is the complete key set; Arabic
 * is a stub that translates the app chrome (nav + footer) and falls back to the
 * English string for anything not yet translated, so adding a page never breaks
 * the AR render, it just shows English until the key is filled in. `t()` is the
 * single lookup with that fallback baked in.
 */

import { DEFAULT_LOCALE, type Locale } from "./locale";

/** The canonical key set; every UI string has an entry here. */
export const EN = {
  "nav.dashboard": "Dashboard",
  "nav.namtheg": "Namtheg",
  "nav.assets": "Assets",
  "nav.customize": "Customize",
  "nav.account": "Account",
  "nav.subscription": "Subscription",
  "footer.madeBy": "Made by",
} as const;

export type MessageKey = keyof typeof EN;

/** Arabic stub: translate the chrome, fall back to English elsewhere. */
const AR: Partial<Record<MessageKey, string>> = {
  "nav.dashboard": "لوحة التحكم",
  "nav.namtheg": "نمذجة",
  "nav.assets": "الأصول",
  "nav.customize": "تخصيص",
  "nav.account": "الحساب",
  "nav.subscription": "الاشتراك",
  "footer.madeBy": "من إعداد",
};

const MESSAGES: Record<Locale, Partial<Record<MessageKey, string>>> = {
  en: EN,
  ar: AR,
};

/** Look up a string for a locale, falling back to English, then the key. */
export function t(locale: Locale, key: MessageKey): string {
  return MESSAGES[locale][key] ?? MESSAGES[DEFAULT_LOCALE][key] ?? key;
}
