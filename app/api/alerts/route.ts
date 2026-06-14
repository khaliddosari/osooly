import { parseChannels, parsePredicate } from "@/lib/alerts/predicates";
import {
  assetBelongsToUser,
  insertAlert,
  listAlertsForUser,
} from "@/lib/alerts/store";
import { auth } from "@/lib/auth";
import { getCard } from "@/lib/cards/registry";
import { getDb } from "@/lib/db";
import { isSameOriginRequest } from "@/lib/http/same-origin";

/**
 * /api/alerts (PRD §3.8a): the per-user "Notify me when …" CRUD behind the
 * card alert UI. GET lists the signed-in user's rules (optionally one card's);
 * POST creates one. The alerts-evaluator Cron Worker reads these rows and POSTs
 * matches to the single n8n webhook.
 *
 * GET is session-gated and read-only. POST writes user state on the ambient
 * cookie, so it carries the same same-origin (CSRF) guard as /api/agent/run.
 */
export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ error: "Sign in to view alerts." }, { status: 401 });
  }

  const cardId = new URL(request.url).searchParams.get("cardId") ?? undefined;
  const db = await getDb();
  const alerts = await listAlertsForUser(db, userId, cardId);
  return Response.json({ alerts });
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginRequest(request)) {
    return Response.json(
      { error: "Cross-site requests are not allowed." },
      { status: 403 }
    );
  }

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ error: "Sign in to set alerts." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const cardId = typeof body.cardId === "string" ? body.cardId : "";
  if (!getCard(cardId)) {
    return Response.json({ error: `Unknown card "${cardId}".` }, { status: 400 });
  }

  const predicate = parsePredicate({
    assetClass: body.assetClass,
    symbol: body.symbol,
    field: body.field,
    op: body.op,
    value: body.value,
    window: body.window,
  });
  if (!predicate) {
    return Response.json(
      { error: "Invalid alert condition." },
      { status: 400 }
    );
  }

  const channels = parseChannels(body.channels);
  if (!channels) {
    return Response.json(
      { error: "Pick at least one delivery channel." },
      { status: 400 }
    );
  }

  const db = await getDb();
  const assetId = typeof body.assetId === "string" ? body.assetId : null;
  if (assetId && !(await assetBelongsToUser(db, userId, assetId))) {
    return Response.json({ error: "Unknown asset." }, { status: 400 });
  }

  const id = await insertAlert(db, {
    userId,
    cardId,
    assetId,
    predicate,
    channels,
  });
  return Response.json({ id }, { status: 201 });
}
