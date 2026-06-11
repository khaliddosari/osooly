"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";

/**
 * Numbered page pills, bottom-right of the dashboard (PRD §3.5): glass
 * surface, cyan-active. Each pill is also a dnd-kit drop target — dropping a
 * card on a pill moves it to that page.
 */
export const PAGE_PILL_PREFIX = "page-pill-";

export function PagePills({
  pageCount,
  activePage,
  onSelect,
}: {
  pageCount: number;
  activePage: number;
  onSelect: (page: number) => void;
}) {
  if (pageCount <= 1) return null;

  return (
    <nav aria-label="Dashboard pages" className="flex justify-end">
      <div className="glass flex items-center gap-1 rounded-full px-2 py-1.5">
        {Array.from({ length: pageCount }, (_, i) => i + 1).map((page) => (
          <PagePill
            key={page}
            page={page}
            active={page === activePage}
            onSelect={onSelect}
          />
        ))}
      </div>
    </nav>
  );
}

function PagePill({
  page,
  active,
  onSelect,
}: {
  page: number;
  active: boolean;
  onSelect: (page: number) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `${PAGE_PILL_PREFIX}${page}`,
    data: { page },
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => onSelect(page)}
      aria-label={`Page ${page}`}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-all duration-300",
        active
          ? "text-on-primary"
          : "text-on-surface-variant hover:text-on-surface",
        isOver && "scale-110 ring-1 ring-primary"
      )}
      style={active ? { background: "var(--accent-gradient)" } : undefined}
    >
      {page}
    </button>
  );
}
