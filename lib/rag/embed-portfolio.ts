import type { RagDocument, RagStore } from "./vectorize";

// KNOWN BUG (github.com/khaliddosari/osooly/issues/1, tracked for later):
// the id built at line ~66
// below concatenates two raw UUIDs ("portfolio:" + userId + ":" + asset.id),
// which comes out to 83 bytes - over Vectorize's 64-byte id limit - so
// syncPortfolioCorpus() fails on every call for any user/asset with a
// standard UUID. The failure is caught and logged in
// lib/agent/orchestrator.ts ("[agent] portfolio corpus sync failed"), so the
// agent run still completes, just silently without portfolio RAG context.
// embed-news.ts already solves this correctly via the stableId() hash helper
// in vectorize.ts; embed-portfolio.ts should use the same helper instead of
// raw concatenation.

/**
 * Portfolio corpus (PRD §3.6 collection a): one document per asset,
 * describing the holding and its ledger movements in plain prose the
 * embedder can place near related market language. Strictly per-user:
 * every doc carries userId metadata and queries always filter on it.
 *
 * v1 re-embeds on every orchestrator run; portfolios are a handful of rows
 * and bge-m3 is keyless, so freshness beats bookkeeping a dirty flag.
 */

export interface PortfolioAssetRow {
  id: string;
  asset_class: string;
  name: string;
  symbol: string | null;
  quantity: number;
  unit: string | null;
  purchase_price: number | null;
  purchase_currency: string;
  purchased_at: string | null;
}

export interface PortfolioTransactionRow {
  asset_id: string;
  kind: string;
  quantity: number;
  price: number | null;
  currency: string;
  occurred_at: string;
}

export function portfolioDocuments(
  userId: string,
  assets: PortfolioAssetRow[],
  transactions: PortfolioTransactionRow[]
): RagDocument[] {
  const txByAsset = new Map<string, PortfolioTransactionRow[]>();
  for (const tx of transactions) {
    const list = txByAsset.get(tx.asset_id) ?? [];
    list.push(tx);
    txByAsset.set(tx.asset_id, list);
  }

  return assets.map((asset) => {
    const lines = [
      `${classLabel(asset.asset_class)} holding: ${asset.name}` +
        (asset.symbol ? ` (${asset.symbol})` : ""),
      `Quantity: ${asset.quantity}${asset.unit ? ` ${asset.unit}` : ""}.`,
      asset.purchase_price !== null
        ? `Purchased at ${asset.purchase_price} ${asset.purchase_currency}` +
          (asset.purchased_at ? ` on ${asset.purchased_at}` : "") +
          "."
        : "No purchase price recorded.",
    ];
    const txs = txByAsset.get(asset.id) ?? [];
    for (const tx of txs.slice(0, 10)) {
      lines.push(
        `Transaction: ${tx.kind} ${tx.quantity}` +
          (tx.price !== null ? ` at ${tx.price} ${tx.currency}` : "") +
          ` on ${tx.occurred_at}.`
      );
    }
    return {
      id: `portfolio:${userId}:${asset.id}`,
      text: lines.join(" "),
      corpus: "portfolio" as const,
      userId,
      assetClass: asset.asset_class,
      title: asset.name,
    };
  });
}

export async function syncPortfolioCorpus(
  store: RagStore,
  db: D1Database,
  userId: string
): Promise<number> {
  const [assets, transactions] = await Promise.all([
    db
      .prepare(
        `SELECT id, asset_class, name, symbol, quantity, unit,
                purchase_price, purchase_currency, purchased_at
         FROM assets WHERE user_id = ?1`
      )
      .bind(userId)
      .all<PortfolioAssetRow>(),
    db
      .prepare(
        `SELECT asset_id, kind, quantity, price, currency, occurred_at
         FROM transactions WHERE user_id = ?1
         ORDER BY occurred_at DESC`
      )
      .bind(userId)
      .all<PortfolioTransactionRow>(),
  ]);
  return store.upsert(
    portfolioDocuments(userId, assets.results, transactions.results)
  );
}

function classLabel(assetClass: string): string {
  switch (assetClass) {
    case "stocks":
      return "Stock";
    case "real_estate":
      return "Real estate";
    case "autos":
      return "Vehicle";
    case "jewelry":
      return "Jewelry";
    default:
      return assetClass;
  }
}
