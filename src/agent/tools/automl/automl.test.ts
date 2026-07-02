import { describe, expect, it } from "vitest";
import { fakeDb, type FakeAsset, type FakeTransaction } from "@/src/cards/testing";
import { buildLedgerCsv, makeRunAutomlTool, MIN_TRAINING_ROWS } from "./index";

const USER = "user-1";

const CFG = {
  baseUrl: "http://sidecar.test",
  internalToken: "secret",
  pollIntervalMs: 0,
};

function ledger(count: number): { assets: FakeAsset[]; transactions: FakeTransaction[] } {
  const assets: FakeAsset[] = [
    {
      id: "p1",
      user_id: USER,
      asset_class: "real_estate",
      name: "Riyadh villa, al-Malqa",
      purchase_price: 1_500_000,
    },
  ];
  const transactions: FakeTransaction[] = Array.from({ length: count }, (_, i) => ({
    user_id: USER,
    asset_id: "p1",
    kind: "buy",
    quantity: 1,
    price: 1_000_000 + i * 10_000,
    occurred_at: `2025-01-${String(i + 1).padStart(2, "0")} 00:00:00`,
  }));
  return { assets, transactions };
}

/** Sequenced fake sidecar: upload -> start -> status* -> result. */
function fakeSidecar(statuses: string[], result?: Record<string, unknown>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  let statusIndex = 0;
  const fetchImpl = (async (url: URL | RequestInfo, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const path = String(url);
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    if (path.endsWith("/upload")) return json({ run_id: "abc123def456" });
    if (path.endsWith("/start")) return json({ status: "queued" });
    if (path.endsWith("/status")) {
      const status = statuses[Math.min(statusIndex, statuses.length - 1)];
      statusIndex++;
      return json({ run_id: "abc123def456", status });
    }
    if (path.endsWith("/result")) return json(result ?? {});
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

describe("buildLedgerCsv", () => {
  it("escapes commas and quotes", () => {
    const csv = buildLedgerCsv([
      { asset_name: 'Villa "A", Riyadh', kind: "buy", quantity: 1, price: 5 },
    ]);
    const [header, row] = csv.split("\n");
    expect(header.split(",")).toHaveLength(8);
    expect(row).toContain('"Villa ""A"", Riyadh"');
  });
});

describe("run_automl", () => {
  it("reports itself unconfigured without sidecar env", async () => {
    const tool = makeRunAutomlTool({ baseUrl: "", internalToken: "" });
    const db = fakeDb({});
    const result = await tool.run({ db, userId: USER }, { assetClass: "real_estate" });
    expect(result.ran).toBe(false);
    if (!result.ran) expect(result.reason).toContain("not configured");
  });

  it("refuses to train on a thin ledger", async () => {
    const { assets, transactions } = ledger(MIN_TRAINING_ROWS - 1);
    const db = fakeDb({ assets, transactions });
    const { fetchImpl, calls } = fakeSidecar(["succeeded"]);
    const tool = makeRunAutomlTool({ ...CFG, fetchImpl });
    const result = await tool.run({ db, userId: USER }, { assetClass: "real_estate" });
    expect(result.ran).toBe(false);
    if (!result.ran) expect(result.rows).toBe(MIN_TRAINING_ROWS - 1);
    expect(calls).toHaveLength(0);
  });

  it("rejects targets that are not ledger columns", async () => {
    const { assets, transactions } = ledger(MIN_TRAINING_ROWS);
    const db = fakeDb({ assets, transactions });
    const tool = makeRunAutomlTool({ ...CFG, fetchImpl: fakeSidecar([]).fetchImpl });
    const result = await tool.run(
      { db, userId: USER },
      { assetClass: "real_estate", target: "sale_price" }
    );
    expect(result.ran).toBe(false);
    if (!result.ran) expect(result.reason).toContain("sale_price");
  });

  it("runs upload -> start -> poll -> result and summarizes the champion", async () => {
    const { assets, transactions } = ledger(12);
    const db = fakeDb({ assets, transactions });
    const { fetchImpl, calls } = fakeSidecar(["running", "succeeded"], {
      model_name: "GradientBoosting",
      accuracy_score: 0.87,
      score_metric: "r2",
      justification: "Strong fit on the ledger.",
    });
    const tool = makeRunAutomlTool({ ...CFG, fetchImpl });
    const result = await tool.run(
      { db, userId: USER },
      { assetClass: "real_estate", target: "price", maxWaitSeconds: 5 }
    );
    expect(result).toMatchObject({
      ran: true,
      runId: "abc123def456",
      status: "succeeded",
      modelName: "GradientBoosting",
      score: 0.87,
      scoreMetric: "r2",
      resultPath: "/namtheg/abc123def456/result",
    });
    // Auth headers ride on every sidecar call.
    for (const call of calls) {
      const headers = call.init?.headers as Record<string, string>;
      expect(headers["X-Osooly-Internal-Token"]).toBe("secret");
      expect(headers["X-Osooly-User-Id"]).toBe(USER);
    }
    // The uploaded CSV carries one line per transaction plus the header.
    const upload = calls.find((c) => c.url.endsWith("/upload"));
    const file = (upload?.init?.body as FormData).get("file") as Blob;
    expect((await file.text()).trim().split("\n")).toHaveLength(13);
  });

  it("surfaces failed runs as data, not exceptions", async () => {
    const { assets, transactions } = ledger(12);
    const db = fakeDb({ assets, transactions });
    const { fetchImpl } = fakeSidecar(["failed"]);
    const tool = makeRunAutomlTool({ ...CFG, fetchImpl });
    const result = await tool.run(
      { db, userId: USER },
      { assetClass: "real_estate", maxWaitSeconds: 5 }
    );
    expect(result).toMatchObject({ ran: true, status: "failed" });
  });

  it("returns a running handle when the wait budget is exhausted", async () => {
    const { assets, transactions } = ledger(12);
    const db = fakeDb({ assets, transactions });
    const { fetchImpl } = fakeSidecar(["running"]);
    const tool = makeRunAutomlTool({ ...CFG, fetchImpl });
    const result = await tool.run(
      { db, userId: USER },
      { assetClass: "real_estate", maxWaitSeconds: 0 }
    );
    expect(result).toMatchObject({
      ran: true,
      status: "running",
      resultPath: "/namtheg/abc123def456/result",
    });
  });
});
