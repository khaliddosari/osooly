import { deleteAlert, setAlertEnabled } from "@/lib/alerts/store";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { isSameOriginRequest } from "@/lib/http/same-origin";

/**
 * /api/alerts/[id] (PRD §3.8a): toggle (PATCH) or remove (DELETE) one of the
 * signed-in user's rules. Both are state-changing cookie-authenticated
 * mutations, so they carry the same same-origin (CSRF) guard as POST. The
 * store scopes every write by user_id, so a guessed id can't touch another
 * user's alert.
 */
type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx): Promise<Response> {
  const guard = await requireOwner(request);
  if ("response" in guard) return guard.response;

  const body = (await request.json().catch(() => null)) as {
    enabled?: unknown;
  } | null;
  if (typeof body?.enabled !== "boolean") {
    return Response.json(
      { error: "Body must set { enabled: boolean }." },
      { status: 400 }
    );
  }

  const { id } = await ctx.params;
  await setAlertEnabled(guard.db, guard.userId, id, body.enabled);
  return Response.json({ ok: true });
}

export async function DELETE(request: Request, ctx: Ctx): Promise<Response> {
  const guard = await requireOwner(request);
  if ("response" in guard) return guard.response;

  const { id } = await ctx.params;
  await deleteAlert(guard.db, guard.userId, id);
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
        { error: "Sign in to manage alerts." },
        { status: 401 }
      ),
    };
  }
  return { userId, db: await getDb() };
}
