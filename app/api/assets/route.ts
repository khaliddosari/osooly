import { insertAsset, listAssetsForUser } from "@/lib/assets/store";
import { parseAssetInput } from "@/lib/assets/schema";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { isSameOriginRequest } from "@/lib/http/same-origin";

/**
 * /api/assets (PRD 3.2, the /assets flat ledger): the per-user holdings CRUD
 * behind the asset table. GET lists the signed-in user's holdings; POST adds
 * one. GET is session-gated and read-only; POST writes user state on the
 * ambient cookie, so it carries the same same-origin (CSRF) guard as
 * /api/alerts and /api/agent/run.
 */
export async function GET(): Promise<Response> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ error: "Sign in to view your assets." }, { status: 401 });
  }

  const db = await getDb();
  const assets = await listAssetsForUser(db, userId);
  return Response.json({ assets });
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
    return Response.json({ error: "Sign in to add assets." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const input = parseAssetInput(body);
  if (!input) {
    return Response.json(
      { error: "A holding needs at least a name and an asset class." },
      { status: 400 }
    );
  }

  const db = await getDb();
  const id = await insertAsset(db, userId, input);
  return Response.json({ id }, { status: 201 });
}
