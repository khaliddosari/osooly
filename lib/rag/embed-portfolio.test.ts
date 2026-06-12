import { describe, expect, it } from "vitest";
import { portfolioDocuments } from "./embed-portfolio";

describe("portfolioDocuments", () => {
  const assets = [
    {
      id: "s1",
      asset_class: "stocks",
      name: "Aramco",
      symbol: "2222",
      quantity: 100,
      unit: "shares",
      purchase_price: 30,
      purchase_currency: "SAR",
      purchased_at: "2025-04-01",
    },
    {
      id: "j1",
      asset_class: "jewelry",
      name: "Gold bracelet",
      symbol: null,
      quantity: 50,
      unit: "grams",
      purchase_price: null,
      purchase_currency: "SAR",
      purchased_at: null,
    },
  ];

  it("writes one prose document per asset with its ledger lines", () => {
    const docs = portfolioDocuments("u1", assets, [
      {
        asset_id: "s1",
        kind: "buy",
        quantity: 100,
        price: 30,
        currency: "SAR",
        occurred_at: "2025-04-01",
      },
    ]);

    expect(docs).toHaveLength(2);
    expect(docs[0].text).toContain("Stock holding: Aramco (2222)");
    expect(docs[0].text).toContain("100 shares");
    expect(docs[0].text).toContain("Purchased at 30 SAR on 2025-04-01");
    expect(docs[0].text).toContain("Transaction: buy 100 at 30 SAR");
    expect(docs[1].text).toContain("No purchase price recorded");
  });

  it("keeps the corpus private per user (PRD 3.9)", () => {
    const docs = portfolioDocuments("u1", assets, []);
    for (const doc of docs) {
      expect(doc.corpus).toBe("portfolio");
      expect(doc.userId).toBe("u1");
      expect(doc.id.startsWith("portfolio:u1:")).toBe(true);
    }
  });
});
