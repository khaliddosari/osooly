import { getLocale } from "@/lib/i18n/server";
import { AmbientField } from "./ambient-field";
import { Header } from "./header";
import { Footer } from "./footer";

/**
 * PC-first app shell (PRD §3.4): top header with the six tabs, page content,
 * glass footer strip, all floating over the ambient glow field. Resolves the
 * active locale once and hands it to the chrome so nav/footer labels match the
 * `<html lang / dir>` the root layout set (PRD §3.9).
 */
export async function LayoutShell({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <div className="relative flex min-h-dvh flex-col">
      <AmbientField />
      <Header locale={locale} />
      <main className="relative z-10 flex flex-1 flex-col">{children}</main>
      <Footer locale={locale} />
    </div>
  );
}
