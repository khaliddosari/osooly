import { deleteAsset, updateAsset } from "@/lib/assets/store";
import { parseAssetInput } from "@/lib/assets/schema";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { isSameOriginRequest } from "@/lib/http/same-origin";

/**
 * /api/assets/[id] (PRD 3.2): edit (PUT) or remove (DELETE) one of the
 * signed-in user's holdings. Both are state-changing cookie-authenticated
 * mutations, so they carry the same same-origin (CSRF) guard as POST. The
 * store scopes every write by user_id, so a guessed id can't touch another
 * user's row.
 */
type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, ctx: Ctx): Promise<Response> {
  const guard = await requireOwner(request);
  if ("response" in guard) return guard.response;

  const body = await request.json().catch(() => null);
  const input = parseAssetInput(body);
  if (!input) {
    return Response.json(
      { error: "A holding needs at least a name and an asset class." },
      { status: 400 }
    );
  }

  const { id } = await ctx.params;
  const changed = await updateAsset(guard.db, guard.userId, id, input);
  if (!changed) {
    return Response.json({ error: "Asset not found." }, { status: 404 });
  }
  return Response.json({ ok: true });
}

export async function DELETE(request: Request, ctx: Ctx): Promise<Response> {
  const guard = await requireOwner(request);
  if ("response" in guard) return guard.response;

  const { id } = await ctx.params;
  const removed = await deleteAsset(guard.db, guard.userId, id);
  if (!removed) {
    return Response.json({ error: "Asset not found." }, { status: 404 });
  }
  return Response.json({ ok: true });
}

async function requireOwner(
  request: Request
): Promise<{ userId: string; db: D1Database } | { response: Response }> {
  if (!isSameOriginRequest(request)) {
    return {
      response: Response.json(
        { error: "Cross-site requests are not allowed." },
        { status: 403 }
      ),
    };
  }
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return {
      response: Response.json(
        { error: "Sign in to manage assets." },
        { status: 401 }
      ),
    };
  }
  return { userId, db: await getDb() };
}
