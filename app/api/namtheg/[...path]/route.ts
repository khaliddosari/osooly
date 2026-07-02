import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isSameOriginRequest } from "@/lib/http/same-origin";

/**
 * Same-origin proxy onto the Namtheg sidecar (PRD 3.7). The browser never
 * talks to the sidecar's port directly: this route forwards the request
 * (with the NextAuth session cookie) so cookies and CORS stay same-origin
 * in dev exactly like the production reverse proxy. The sidecar's
 * auth_bridge validates the forwarded session against the shared D1; this
 * layer only enforces the CSRF posture and the endpoint allowlist.
 */

const RUN_ID = "[a-f0-9]{12}";
const GET_PATHS = [
  /^runs$/,
  new RegExp(`^runs/${RUN_ID}/(preview|status|result|plot|model_schema)$`),
];
const POST_PATHS = [
  /^upload$/,
  new RegExp(`^runs/${RUN_ID}/(start|predict)$`),
];

function sidecarBase(env: CloudflareEnv): string {
  return (env.NAMTHEG_SIDECAR_URL || "http://localhost:8000").replace(/\/+$/, "");
}

async function forward(
  request: Request,
  path: string,
  allowlist: RegExp[]
): Promise<Response> {
  if (!allowlist.some((re) => re.test(path))) {
    return Response.json({ detail: "Unknown Namtheg endpoint." }, { status: 404 });
  }

  const { env } = await getCloudflareContext({ async: true });
  const headers = new Headers();
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  let upstream: Response;
  try {
    upstream = await fetch(`${sidecarBase(env)}/${path}`, {
      method: request.method,
      headers,
      body: request.method === "POST" ? request.body : undefined,
      // Node's fetch requires half-duplex for streamed request bodies; the
      // workers runtime ignores the flag.
      ...({ duplex: "half" } as Record<string, unknown>),
    });
  } catch (error) {
    console.error("[namtheg] sidecar unreachable:", error);
    return Response.json(
      {
        detail:
          "The Namtheg service is not reachable. Start the sidecar (see sidecar/README.md) and set NAMTHEG_SIDECAR_URL.",
      },
      { status: 502 }
    );
  }

  const responseHeaders = new Headers();
  const upstreamType = upstream.headers.get("content-type");
  if (upstreamType) responseHeaders.set("content-type", upstreamType);
  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
): Promise<Response> {
  const { path } = await params;
  return forward(request, path.join("/"), GET_PATHS);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
): Promise<Response> {
  if (!isSameOriginRequest(request)) {
    return Response.json(
      { detail: "Cross-site requests are not allowed." },
      { status: 403 }
    );
  }
  const { path } = await params;
  return forward(request, path.join("/"), POST_PATHS);
}
