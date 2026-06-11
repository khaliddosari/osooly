import { AmbientField } from "./ambient-field";
import { Header } from "./header";
import { Footer } from "./footer";

/**
 * PC-first app shell (PRD §3.4): top header with the six tabs, page content,
 * glass footer strip — all floating over the ambient glow field.
 */
export function LayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <AmbientField />
      <Header />
      <main className="relative z-10 flex flex-1 flex-col">{children}</main>
      <Footer />
    </div>
  );
}
