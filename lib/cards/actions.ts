"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { loadCardOrder, saveCardOrder } from "./layout-store";
import { getCard } from "./registry";
import type { CardRect } from "./types";

/**
 * Server actions behind the dashboard grid and the Customize sheet. Every
 * mutation re-solves the full order server-side so D1 only ever holds rects
 * the layoutSolver produced.
 */

type LayoutResult =
  | { ok: true; rects: CardRect[] }
  | { ok: false; error: string };

async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/** Persist a full reorder (drag-drop, move-to-page). */
export async function persistCardOrder(
  orderedCardIds: string[]
): Promise<LayoutResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Sign in to save your layout." };

  // Never trust the client list: keep only known cards, deduped.
  const order = [...new Set(orderedCardIds)].filter((id) => getCard(id));
  const rects = await saveCardOrder(userId, order);
  revalidatePath("/dashboard");
  return { ok: true, rects };
}

/** Add a card from the Customize sheet (appends to the end of the layout). */
export async function addCard(cardId: string): Promise<LayoutResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Sign in to customize your dashboard." };
  if (!getCard(cardId)) return { ok: false, error: `Unknown card "${cardId}".` };

  const order = await loadCardOrder(userId);
  if (!order.includes(cardId)) order.push(cardId);
  const rects = await saveCardOrder(userId, order);
  revalidatePath("/dashboard");
  revalidatePath("/customize");
  return { ok: true, rects };
}

/** Remove a card; the solver re-flows the survivors. */
export async function removeCard(cardId: string): Promise<LayoutResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Sign in to customize your dashboard." };

  const order = (await loadCardOrder(userId)).filter((id) => id !== cardId);
  const rects = await saveCardOrder(userId, order);
  revalidatePath("/dashboard");
  revalidatePath("/customize");
  return { ok: true, rects };
}
