import type { Metadata } from "next";
import "./globals.css";
import { LayoutShell } from "@/components/layout-shell";
import { dir } from "@/lib/i18n/locale";
import { getLocale } from "@/lib/i18n/server";

const TITLE = "Osooly — أصولي";
const DESCRIPTION =
  "An agentic personal-finance assistant. One dashboard for everything you own — equities, real estate, automobiles, jewelry — with an agent that thinks about your assets so you don't have to.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    title: TITLE,
    description: DESCRIPTION,
    siteName: "Osooly",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Locale drives the language tag and the RTL flip (PRD §3.9); v1 ships EN
  // full with AR stubbed. Dark-only is a design-system hard rule, so the class
  // is fixed regardless of locale.
  const locale = await getLocale();
  return (
    <html lang={locale} dir={dir(locale)} className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
          crossOrigin="anonymous"
        />
        {/* Font Awesome 6.5.1 — the only icon set (design-system hard rule) */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
          integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA=="
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      </head>
      <body className="bg-surface text-on-surface antialiased">
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}
