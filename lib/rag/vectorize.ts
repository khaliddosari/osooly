/**
 * The dual RAG corpora (PRD §3.6): one Cloudflare Vectorize index, two
 * collections separated by a `corpus` metadata field; "portfolio" rows are
 * private per userId, "news" rows are platform-shared. Embeddings come from
 * Workers AI @cf/baai/bge-m3 (multilingual; EN + AR headlines).
 *
 * Imported by both the Next.js app and workers/cron, so: relative imports
 * only, no LangChain, and bindings are passed in rather than pulled from a
 * request context (same rules as lib/market-snapshot.ts).
 *
 * Local dev has no Vectorize simulator, so makeRagStore degrades to a
 * NullRagStore when either binding is missing; the agent then runs with
 * empty context instead of failing (PRD §3.6).
 *
 * Deploy-time setup (S10), documented here so it isn't lost:
 *   wrangler vectorize create osooly-rag --dimensions=1024 --metric=cosine
 *   wrangler vectorize create-metadata-index osooly-rag --property-name=corpus --type=string
 *   wrangler vectorize create-metadata-index osooly-rag --property-name=userId --type=string
 *   wrangler vectorize create-metadata-index osooly-rag --property-name=assetClass --type=string
 */

export const EMBEDDING_MODEL = "@cf/baai/bge-m3";
export const VECTORIZE_INDEX_NAME = "osooly-rag";

/** Vectorize caps metadata at 10KiB/vector; keep snippets well under it. */
const MAX_SNIPPET_CHARS = 1500;

export type RagCorpus = "portfolio" | "news";

export interface RagDocument {
  /** Stable id so re-embedding upserts instead of duplicating. */
  id: string;
  text: string;
  corpus: RagCorpus;
  /** Required for portfolio docs; never set on shared news docs. */
  userId?: string;
  assetClass?: string;
  title?: string;
  url?: string;
  publishedAt?: string;
}

export interface RagQuery {
  corpus: RagCorpus;
  userId?: string;
  assetClass?: string;
  topK?: number;
}

export interface RagStore {
  upsert(docs: RagDocument[]): Promise<number>;
  /** Returns snippet texts, best match first. */
  query(text: string, query: RagQuery): Promise<string[]>;
}

/** Stand-in when bindings are absent (local dev): no context, no failures. */
export class NullRagStore implements RagStore {
  async upsert(): Promise<number> {
    return 0;
  }
  async query(): Promise<string[]> {
    return [];
  }
}

interface EmbeddingResponse {
  data: number[][];
}

export class VectorizeRagStore implements RagStore {
  constructor(
    private readonly ai: Ai,
    private readonly index: VectorizeIndex
  ) {}

  private async embed(texts: string[]): Promise<number[][]> {
    const response = (await this.ai.run(EMBEDDING_MODEL, {
      text: texts,
    })) as unknown as EmbeddingResponse;
    if (!Array.isArray(response?.data)) {
      throw new Error(`unexpected ${EMBEDDING_MODEL} response shape`);
    }
    return response.data;
  }

  async upsert(docs: RagDocument[]): Promise<number> {
    if (docs.length === 0) return 0;
    const vectors = await this.embed(docs.map((d) => d.text));
    await this.index.upsert(
      docs.map((doc, i) => ({
        id: doc.id,
        values: vectors[i],
        metadata: {
          corpus: doc.corpus,
          text: doc.text.slice(0, MAX_SNIPPET_CHARS),
          ...(doc.userId && { userId: doc.userId }),
          ...(doc.assetClass && { assetClass: doc.assetClass }),
          ...(doc.title && { title: doc.title }),
          ...(doc.url && { url: doc.url }),
          ...(doc.publishedAt && { publishedAt: doc.publishedAt }),
        },
      }))
    );
    return docs.length;
  }

  async query(text: string, query: RagQuery): Promise<string[]> {
    // Portfolio queries must always be user-filtered; a missing userId may
    // not silently widen into reading other users' ledgers (PRD §3.9).
    if (query.corpus === "portfolio" && !query.userId) return [];
    const [vector] = await this.embed([text]);
    const matches = await this.index.query(vector, {
      topK: query.topK ?? 3,
      returnMetadata: "all",
      filter: {
        corpus: query.corpus,
        ...(query.userId && { userId: query.userId }),
        ...(query.assetClass && { assetClass: query.assetClass }),
      },
    });
    return matches.matches.flatMap((match) => {
      const meta = match.metadata as Record<string, unknown> | undefined;
      const snippet = typeof meta?.text === "string" ? meta.text : null;
      if (!snippet) return [];
      const title = typeof meta?.title === "string" ? `${meta.title}: ` : "";
      return [`${title}${snippet}`];
    });
  }
}

export function makeRagStore(env: {
  AI?: Ai;
  VECTORIZE?: VectorizeIndex;
}): RagStore {
  if (!env.AI || !env.VECTORIZE) return new NullRagStore();
  return new VectorizeRagStore(env.AI, env.VECTORIZE);
}

/** FNV-1a 64-bit hex digest: stable, dependency-free vector ids. */
export function stableId(prefix: string, value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (let i = 0; i < value.length; i++) {
    hash ^= BigInt(value.charCodeAt(i));
    hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return `${prefix}:${hash.toString(16).padStart(16, "0")}`;
}
