"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { BrandLockup } from "./brand";

/** The six v1 tabs, in PRD §3.4 order. */
const TABS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Namtheg", href: "/namtheg" },
  { label: "Assets", href: "/assets" },
  { label: "Customize", href: "/customize" },
  { label: "Account", href: "/account" },
  { label: "Subscription", href: "/subscription" },
] as const;

export function Header() {
  const pathname = usePathname() ?? "";

  return (
    <header className="sticky top-0 z-20 glass-strong border-b border-outline-variant">
      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-x-8 px-gutter py-3">
        <Link
          href="/dashboard"
          aria-label="Osooly dashboard"
          className="justify-self-start leading-none"
        >
          <BrandLockup className="text-base" />
        </Link>

        <nav aria-label="Primary" className="justify-self-center">
          <ul className="flex flex-wrap items-center gap-2">
            {TABS.map((tab) => {
              const active =
                pathname === tab.href || pathname.startsWith(`${tab.href}/`);
              return (
                <li key={tab.href}>
                  <Link
                    href={tab.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative inline-flex items-center rounded-lg px-3 py-2 text-sm font-semibold transition-colors duration-300",
                      active
                        ? "text-primary"
                        : "text-on-surface-variant hover:text-on-surface"
                    )}
                  >
                    {tab.label}
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-3 -bottom-px h-0.5 rounded-full"
                        style={{ background: "var(--accent-gradient)" }}
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Empty third column keeps the nav optically centered in the grid */}
        <div aria-hidden="true" />
      </div>
    </header>
  );
}
