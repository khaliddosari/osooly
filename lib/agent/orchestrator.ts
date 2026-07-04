import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type { CardServerContext } from "@/lib/cards/server-context";
import {
  insertRecommendations,
  type NewRecommendation,
} from "@/lib/recommendations";
import { syncPortfolioCorpus } from "@/lib/rag/embed-portfolio";
import { NullRagStore, type RagStore } from "@/lib/rag/vectorize";
import type { AssetClass } from "@/lib/market-snapshot";
import { draftRecommendation } from "./draft";
import type { AgentEnv } from "./env";
import { fetchLiveNews } from "./live-news";
import {
  buildBoundModel,
  modelStamp,
  type BoundModel,
} from "./models/router";
import { buildPlan, type ClassPlan } from "./supervisor";
import { autosSubAgent } from "./sub-agents/autos";
import { jewelrySubAgent } from "./sub-agents/jewelry";
import { realEstateSubAgent } from "./sub-agents/real-estate";
import { stocksSubAgent } from "./sub-agents/stocks";
import { collectFreshness, type SubAgent } from "./sub-agents/types";

/**
 * The S6 orchestrator (PRD §3.6): a LangGraph state machine with one
 * supervisor node and one sub-agent node per asset class. The supervisor
 * plans the run from the user's ledger (and refreshes the portfolio RAG
 * corpus); planned sub-agent nodes fan out in parallel, each turning tool
 * evidence into per-asset drafts through the cheap-first model policy; the
 * persist node writes the batch as Recommendation rows for the cards.
 *
 * Failure posture matches the rest of the platform (PRD §3.5a rule 2): a
 * failing class or asset degrades to fewer recommendations, never to a
 * failed run. Only a completely unconfigured model layer is a hard error,
 * and the API route reports that before the graph ever starts.
 */

const AgentState = Annotation.Root({
  plan: Annotation<ClassPlan[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  drafts: Annotation<NewRecommendation[]>({
    reducer: (prev, next) => prev.concat(next),
    default: () => [],
  }),
  written: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),
  // Tokens spent across every model call in the run, summed as the class
  // nodes report theirs, so the run route can meter it against the per-user
  // monthly cap (PRD §3.9).
  tokens: Annotation<number>({
    reducer: (prev, next) => prev + next,
    default: () => 0,
  }),
});

export interface AgentModels {
  /** Cheap triage (router: classification) and escalation (reasoning). */
  triage: BoundModel;
  reasoning: BoundModel;
}

export interface AgentRunDeps {
  db: D1Database;
  userId: string;
  env?: AgentEnv;
  /** Defaults to NullRagStore: no bindings, no context, no failure. */
  rag?: RagStore;
  /** Test seam; production builds these from env via the router policy. */
  models?: AgentModels;
  /** Test seam; production searches xAI Grok, then DeepSeek web search. */
  liveNews?: (assetClass: AssetClass) => Promise<string[]>;
}

export interface AgentRunResult {
  written: number;
  classes: string[];
  /** Total model tokens this run spent (PRD §3.9); recorded to the counter. */
  tokensUsed: number;
}

export async function runAgentForUser(
  deps: AgentRunDeps
): Promise<AgentRunResult> {
  const ctx: CardServerContext = { db: deps.db, userId: deps.userId };
  const rag = deps.rag ?? new NullRagStore();
  const models: AgentModels = deps.models ?? {
    triage: buildBoundModel("classification", deps.env ?? {}),
    reasoning: buildBoundModel("reasoning", deps.env ?? {}),
  };
  const liveNews =
    deps.liveNews ??
    ((assetClass: AssetClass) => fetchLiveNews(assetClass, deps.env ?? {}));

  // One sub-agent node per asset class; a failing class degrades to fewer
  // drafts, never to a failed run.
  const classNode = (agent: SubAgent) => async () => {
    try {
      const { drafts, tokens } = await runSubAgent(
        agent,
        ctx,
        rag,
        models,
        liveNews
      );
      return { drafts, tokens };
    } catch (error) {
      console.error(`[agent] ${agent.assetClass} sub-agent failed:`, error);
      return {};
    }
  };

  const graph = new StateGraph(AgentState)
    .addNode("supervisor", async () => {
      try {
        await syncPortfolioCorpus(rag, ctx.db, deps.userId);
      } catch (error) {
        console.error("[agent] portfolio corpus sync failed:", error);
      }
      return { plan: await buildPlan(ctx) };
    })
    .addNode("stocks", classNode(stocksSubAgent))
    .addNode("real_estate", classNode(realEstateSubAgent))
    .addNode("autos", classNode(autosSubAgent))
    .addNode("jewelry", classNode(jewelrySubAgent))
    .addNode("persist", async (state) => ({
      written: await insertRecommendations(ctx.db, state.drafts),
    }))
    .addEdge(START, "supervisor")
    // Fan out to exactly the planned classes; an empty ledger goes straight
    // to persist so the graph always reaches END.
    .addConditionalEdges(
      "supervisor",
      (state) =>
        state.plan.length > 0
          ? state.plan.map((entry) => entry.assetClass)
          : ["persist"],
      ["stocks", "real_estate", "autos", "jewelry", "persist"]
    )
    .addEdge("stocks", "persist")
    .addEdge("real_estate", "persist")
    .addEdge("autos", "persist")
    .addEdge("jewelry", "persist")
    .addEdge("persist", END);

  const finalState = await graph.compile().invoke({});
  return {
    written: finalState.written,
    classes: finalState.plan.map((entry) => entry.assetClass),
    tokensUsed: finalState.tokens,
  };
}

async function runSubAgent(
  agent: SubAgent,
  ctx: CardServerContext,
  rag: RagStore,
  models: AgentModels,
  liveNews: (assetClass: AssetClass) => Promise<string[]>
): Promise<{ drafts: NewRecommendation[]; tokens: number }> {
  // One live search per class per run (PRD §3.6); a failed search degrades
  // to RSS-corpus context only, never to a failed class.
  let liveLines: string[] = [];
  try {
    liveLines = await liveNews(agent.assetClass);
  } catch (error) {
    console.error(`[agent] live news failed for ${agent.assetClass}:`, error);
  }

  const drafts: NewRecommendation[] = [];
  let tokens = 0;
  for (const asset of await agent.gather(ctx)) {
    let ragContext: string[] = [];
    try {
      const query = `${agent.assetClass} ${asset.assetName} outlook`;
      const [portfolio, news] = await Promise.all([
        rag.query(query, {
          corpus: "portfolio",
          userId: ctx.userId ?? undefined,
          topK: 2,
        }),
        rag.query(query, {
          corpus: "news",
          assetClass: agent.assetClass,
          topK: 3,
        }),
      ]);
      ragContext = [...liveLines, ...portfolio, ...news];
    } catch (error) {
      console.error(`[agent] RAG query failed for ${asset.assetName}:`, error);
      ragContext = [...liveLines];
    }

    const outcome = await draftRecommendation(
      {
        assetClass: agent.assetClass,
        assetName: asset.assetName,
        evidence: JSON.stringify(asset.evidence),
        ragContext,
        freshness: collectFreshness(asset.evidence),
      },
      models
    );
    tokens += outcome.tokens;
    drafts.push({
      userId: ctx.userId as string,
      assetId: asset.assetId,
      cardId: agent.cardId,
      action: outcome.action,
      reasoning: outcome.reasoning,
      confidence: outcome.confidence,
      model: modelStamp(outcome.modelChoice),
    });
  }
  return { drafts, tokens };
}
