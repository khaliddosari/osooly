import type { Freshness } from "@/lib/market-snapshot";
import {
  RECOMMENDATION_ACTIONS,
  type RecommendationAction,
} from "@/lib/recommendations";
import { shouldEscalate, type BoundModel } from "./models/router";

/**
 * Per-asset drafting (PRD §3.6): a cheap triage call classifies whether the
 * holding needs attention; uncertain or buy/sell triages escalate to the
 * reasoning model for the full draft. Both calls speak strict JSON so the
 * output maps 1:1 onto a Recommendation row; no free-text parsing heroics.
 */

export interface AssetBrief {
  assetClass: string;
  assetName: string;
  /** JSON-stringified tool outputs; the only market facts the model gets. */
  evidence: string;
  /** Retrieved RAG snippets (portfolio + news); empty when RAG is offline. */
  ragContext: string[];
  /** Freshness of every reading in the evidence, for the confidence cap. */
  freshness: Freshness[];
}

export interface Draft {
  action: RecommendationAction;
  reasoning: string;
  confidence: number;
}

export interface DraftOutcome extends Draft {
  /** True when the reasoning model produced the final word. */
  escalated: boolean;
}

const JSON_CONTRACT = `Respond with ONLY a compact JSON object, no prose and no code fences:
{"action": "buy" | "sell" | "hold" | "watch", "confidence": <number 0..1>, "reasoning": "<2-4 sentences citing the evidence numbers>"}`;

function contextBlock(brief: AssetBrief): string {
  return brief.ragContext.length > 0
    ? `\nBackground snippets (may be partial or noisy):\n${brief.ragContext
        .map((s) => `- ${s}`)
        .join("\n")}`
    : "";
}

export function triageMessages(
  brief: AssetBrief
): ["system" | "human", string][] {
  return [
    [
      "system",
      `You are the Osooly ${brief.assetClass} market analyst doing a fast triage. Decide whether this holding needs attention right now. Default to "hold" or "watch" unless the evidence clearly argues otherwise. Stale or unavailable market data must lower your confidence. ${JSON_CONTRACT}`,
    ],
    [
      "human",
      `Holding: ${brief.assetName}\nEvidence (cached market data + ledger):\n${brief.evidence}${contextBlock(brief)}`,
    ],
  ];
}

export function reasoningMessages(
  brief: AssetBrief
): ["system" | "human", string][] {
  return [
    [
      "system",
      `You are the senior Osooly ${brief.assetClass} analyst. Draft a recommendation for this holding: weigh cost basis against current market value, the trend in the evidence, and the background snippets. Be conservative; this is decision support, not brokerage execution. Stale or unavailable market data must lower your confidence. ${JSON_CONTRACT}`,
    ],
    [
      "human",
      `Holding: ${brief.assetName}\nEvidence (cached market data + ledger):\n${brief.evidence}${contextBlock(brief)}`,
    ],
  ];
}

/**
 * Strict-ish JSON reader for model replies: tolerates code fences and
 * leading prose, nothing else. Throws on anything that doesn't contain a
 * valid draft object; callers decide the fallback.
 */
export function parseDraft(content: unknown): Draft {
  const text = contentToString(content);
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error(`model reply contains no JSON object: ${text.slice(0, 120)}`);
  }
  const parsed = JSON.parse(text.slice(start, end + 1)) as {
    action?: unknown;
    confidence?: unknown;
    reasoning?: unknown;
  };

  const action = String(parsed.action ?? "").toLowerCase();
  if (!(RECOMMENDATION_ACTIONS as readonly string[]).includes(action)) {
    throw new Error(`model reply has invalid action: ${String(parsed.action)}`);
  }
  const reasoning = String(parsed.reasoning ?? "").trim();
  if (!reasoning) {
    throw new Error("model reply has empty reasoning");
  }
  const confidence = Number(parsed.confidence);
  return {
    action: action as RecommendationAction,
    reasoning,
    confidence: Number.isFinite(confidence)
      ? Math.min(1, Math.max(0, confidence))
      : 0,
  };
}

/** LangChain message content is string or an array of content parts. */
export function contentToString(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === "string"
          ? part
          : String((part as { text?: unknown })?.text ?? "")
      )
      .join("");
  }
  return String(content ?? "");
}

/**
 * The agent treats stale data as low-confidence input (PRD §3.5a rule 2):
 * any non-fresh reading in the evidence caps the stated confidence, however
 * sure the model claims to be.
 */
export const STALE_CONFIDENCE_CAP = 0.5;

export function capForStaleness(
  confidence: number,
  freshness: Freshness[]
): number {
  return freshness.some((f) => f !== "fresh")
    ? Math.min(confidence, STALE_CONFIDENCE_CAP)
    : confidence;
}

/**
 * Cheap-first, escalate on low confidence (PRD §3.6). An unparseable reply
 * from the cheap model escalates; an unparseable reply from the reasoning
 * model degrades to a clearly-labelled low-confidence watch instead of
 * fabricating analysis.
 */
export async function draftRecommendation(
  brief: AssetBrief,
  models: { triage: BoundModel; reasoning: BoundModel }
): Promise<DraftOutcome & { modelChoice: BoundModel["choice"] }> {
  let triage: Draft | null = null;
  try {
    const reply = await models.triage.chat.invoke(triageMessages(brief));
    triage = parseDraft(reply.content);
  } catch {
    triage = null; // unparseable or failed cheap call: escalate
  }

  if (triage && !shouldEscalate(triage)) {
    return {
      ...triage,
      confidence: capForStaleness(triage.confidence, brief.freshness),
      escalated: false,
      modelChoice: models.triage.choice,
    };
  }

  let draft: Draft;
  try {
    const reply = await models.reasoning.chat.invoke(reasoningMessages(brief));
    draft = parseDraft(reply.content);
  } catch {
    draft = {
      action: "watch",
      reasoning:
        "The analyst model did not return a usable draft for this holding; treating it as a low-confidence watch until the next run.",
      confidence: 0.2,
    };
  }
  return {
    ...draft,
    confidence: capForStaleness(draft.confidence, brief.freshness),
    escalated: true,
    modelChoice: models.reasoning.choice,
  };
}
