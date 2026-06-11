"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addCard, removeCard } from "@/lib/cards/actions";
import { listCardsByCategory } from "@/lib/cards/registry";
import type { CardCategory, CardDefinition } from "@/lib/cards/types";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";

const CATEGORY_LABELS: Record<CardCategory, string> = {
  market: "Market",
  portfolio: "Portfolio",
  tools: "Tools",
};

/**
 * The Customize sheet (PRD §3.4/§3.5): the card registry grouped by
 * category, with add/remove per card. Rendered as the /customize page in v1;
 * the empty-state placeholder links straight here.
 */
export function CustomizeSheet({
  installedCardIds,
  canEdit,
}: {
  installedCardIds: string[];
  canEdit: boolean;
}) {
  const groups = listCardsByCategory();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="flex flex-col items-center gap-2 text-center">
        <h1 className="section-title text-headline-md">Customize</h1>
        <p className="mt-4 max-w-md text-body-md text-on-surface-variant">
          Add the asset classes you care about. The grid lays cards out for
          you — drag them on the dashboard to rearrange.
        </p>
      </header>

      {!canEdit && (
        <p
          role="status"
          className="glass px-5 py-4 text-center text-body-md text-warning-orange"
        >
          Sign in with Google to add cards and save your dashboard.
        </p>
      )}

      {groups.length === 0 ? (
        <div className="glass flex flex-col items-center gap-3 border-dashed px-10 py-12 text-center">
          <Icon
            name="hourglass_empty"
            className="text-on-surface-variant"
            style={{ fontSize: 22 }}
          />
          <p className="text-body-md text-on-surface-variant">
            The card catalogue is empty — the four v1 market cards (stocks,
            real estate, automobiles, jewelry) are on their way.
          </p>
        </div>
      ) : (
        groups.map(({ category, cards }) => (
          <section key={category} className="flex flex-col gap-3">
            <h2 className="text-label-md uppercase tracking-wider text-on-surface-variant">
              {CATEGORY_LABELS[category]}
            </h2>
            <ul className="flex flex-col gap-3">
              {cards.map((card) => (
                <CardRow
                  key={card.id}
                  card={card}
                  installed={installedCardIds.includes(card.id)}
                  canEdit={canEdit}
                />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function CardRow({
  card,
  installed,
  canEdit,
}: {
  card: CardDefinition;
  installed: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = installed ? await removeCard(card.id) : await addCard(card.id);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <li className="glass glass-hover flex items-center gap-4 px-5 py-4">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-purple-tint">
        <Icon name={card.icon} className="text-primary" style={{ fontSize: 18 }} />
      </span>
      <div className="flex flex-1 flex-col">
        <span className="text-body-md font-semibold text-on-surface">
          {card.title}
        </span>
        {error && (
          <span role="alert" className="text-label-sm text-warning-orange">
            {error}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={!canEdit || pending}
        className={cn(
          "btn-glass px-4 py-2 text-sm",
          !canEdit && "cursor-not-allowed opacity-50"
        )}
      >
        <Icon
          name={installed ? "remove" : "add"}
          style={{ fontSize: 12 }}
        />
        {installed ? "Remove" : "Add"}
      </button>
    </li>
  );
}
