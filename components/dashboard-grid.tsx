"use client";

import { useMemo, useState, useTransition } from "react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { persistCardOrder } from "@/lib/cards/actions";
import { layoutSolver, rectsByPage } from "@/lib/cards/layout-solver";
import { getCard } from "@/lib/cards/registry";
import type { CardDefinition, CardRect } from "@/lib/cards/types";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";
import { PagePills } from "./page-pills";

/**
 * The paginated card grid (PRD §3.5). The client owns the card *order*;
 * geometry always comes from the layoutSolver, so what the user drags is
 * exactly what gets persisted. Drag handles are card title bars; dropping on
 * another card reorders, dropping on a page pill moves the card to that page.
 */
export function DashboardGrid({ initialOrder }: { initialOrder: string[] }) {
  const [order, setOrder] = useState(initialOrder);
  const [activePage, setActivePage] = useState(1);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const rects = useMemo(
    () =>
      layoutSolver(
        order
          .map((id) => getCard(id))
          .filter((def): def is CardDefinition => def !== undefined)
          .map((def) => ({
            id: def.id,
            defaultSize: def.defaultSize,
            minSize: def.minSize,
          }))
      ),
    [order]
  );
  const pages = rectsByPage(rects);
  const page = Math.min(activePage, Math.max(pages.length, 1));
  const pageRects = pages[page - 1] ?? [];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  function applyOrder(next: string[]) {
    setOrder(next);
    setSaveError(null);
    startTransition(async () => {
      const result = await persistCardOrder(next);
      if (!result.ok) setSaveError(result.error);
    });
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const cardId = String(active.id);
    const from = order.indexOf(cardId);
    if (from === -1) return;

    const targetPage = over.data.current?.page as number | undefined;
    if (targetPage !== undefined) {
      // Dropped on a page pill → append to that page (it re-flows from there).
      const pageCards = (pages[targetPage - 1] ?? []).map((r) => r.cardId);
      const last = pageCards.filter((id) => id !== cardId).at(-1);
      const without = order.filter((id) => id !== cardId);
      const insertAt = last !== undefined ? without.indexOf(last) + 1 : without.length;
      const next = [...without.slice(0, insertAt), cardId, ...without.slice(insertAt)];
      applyOrder(next);
      setActivePage(targetPage);
      return;
    }

    // Dropped on another card → take its slot.
    const to = order.indexOf(String(over.id));
    if (to === -1) return;
    const next = [...order];
    next.splice(from, 1);
    next.splice(to, 0, cardId);
    applyOrder(next);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex flex-1 flex-col gap-4 px-gutter py-6">
        <div
          className="grid flex-1 gap-gutter"
          style={{
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gridTemplateRows: "repeat(3, minmax(10rem, 1fr))",
          }}
        >
          {pageRects.map((rect) => (
            <GridCard key={rect.cardId} rect={rect} />
          ))}
        </div>

        <div className="flex items-center justify-end gap-4">
          {saveError && (
            <p role="status" className="text-label-sm text-warning-orange">
              {saveError}
            </p>
          )}
          <PagePills
            pageCount={pages.length}
            activePage={page}
            onSelect={setActivePage}
          />
        </div>
      </div>
    </DndContext>
  );
}

function GridCard({ rect }: { rect: CardRect }) {
  const def = getCard(rect.cardId);
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: rect.cardId });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: rect.cardId });

  if (!def) return null;

  return (
    <section
      ref={setDropRef}
      aria-label={def.title}
      className={cn(
        "relative",
        isOver && "rounded-[var(--radius)] ring-1 ring-primary"
      )}
      style={{
        gridColumn: `${rect.x + 1} / span ${rect.w}`,
        gridRow: `${rect.y + 1} / span ${rect.h}`,
      }}
    >
      <div
        ref={setNodeRef}
        className={cn(
          "glass flex h-full flex-col overflow-hidden",
          isDragging && "z-30 opacity-80 shadow-2xl"
        )}
        style={{ transform: CSS.Translate.toString(transform) }}
      >
        <header
          {...attributes}
          {...listeners}
          className="flex cursor-grab items-center gap-3 border-b border-outline-variant px-5 py-3 active:cursor-grabbing"
        >
          <Icon name={def.icon} className="text-primary" style={{ fontSize: 16 }} />
          <h2 className="flex-1 truncate text-label-md text-on-surface">
            {def.title}
          </h2>
          <Icon
            name="drag_indicator"
            className="text-on-surface-variant"
            style={{ fontSize: 14 }}
            title="Drag to rearrange"
          />
        </header>
        <div className="flex-1 overflow-auto p-5">
          <def.Component size={{ w: rect.w, h: rect.h }} />
        </div>
      </div>
    </section>
  );
}
