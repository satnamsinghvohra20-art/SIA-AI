const { callOpenRouter, isFreeTierAccount, refreshAccountTier } = require("./openrouterClient");
const siaIdentity = require("./siaIdentity");

const FREE_COUNCIL_MODELS = [
  {
    id: "nvidia/nemotron-3-ultra-550b-a55b:free",
    label: "Nemotron 3 Ultra 550B",
    specialty: "Deep Reasoning, Math & Systems Architecture",
  },
  {
    id: "cohere/north-mini-code:free",
    label: "Cohere North Mini Code",
    specialty: "Code Engineering, Logic & Tactical Precision",
  },
  {
    id: "baidu/ernie-5.5-flash-preview:free",
    label: "ERNIE 5.5 Flash",
    specialty: "1M-Context Knowledge & Structured Synthesis",
  },
];
const FREE_SYNTHESIS_MODEL = "cohere/north-mini-code:free";

const PAID_COUNCIL_MODELS = [
  {
    id: "anthropic/claude-sonnet-5.5",
    label: "Claude Sonnet 5.5",
    specialty: "Software Architecture, Nuance & Rigor",
  },
  {
    id: "deepseek/deepseek-v4.1-flash",
    label: "DeepSeek V4.1 Flash",
    specialty: "STEM, Math & High-Throughput Logic",
  },
  {
    id: "google/gemini-3.8-flash",
    label: "Gemini 3.8 Flash",
    specialty: "1M-Context Multimodal & Rapid Synthesis",
  },
];
const PAID_SYNTHESIS_MODEL = "openai/gpt-6.1-terra";

function getCouncilConfig() {
  const freeTier = isFreeTierAccount();
  return {
    freeTier,
    models: freeTier ? FREE_COUNCIL_MODELS : PAID_COUNCIL_MODELS,
    synthesisModel: freeTier ? FREE_SYNTHESIS_MODEL : PAID_SYNTHESIS_MODEL,
  };
}

/**
 * Runs multi-model consensus deliberation.
 * Queries specialized top AI models in parallel, extracts their strongest verified
 * insights, and synthesizes a unified master answer.
 */
async function runCouncilConsensus({ message, history = [], onProgress, modelsOverride = null }) {
  await refreshAccountTier();
  const cfg = getCouncilConfig();
  const councilModels = modelsOverride || cfg.models;
  const synthesisModel = cfg.synthesisModel;
  const tStartAll = Date.now();

  if (onProgress) onProgress({ status: "dispatching", models: councilModels });

  const modelPromises = councilModels.map(async ({ id, label, specialty }) => {
    const t0 = Date.now();
    try {
      if (onProgress) onProgress({ status: "model_start", model: id, label });
      const promptMessages = [
        {
          role: "system",
          content: `You are an elite specialist in Sia's Multi-Model Fusion Council. Focus on your strength (${specialty}). Give your sharpest, highest-signal, accurate answer (under 180 words unless code is requested).`,
        },
        ...history.slice(-4),
        { role: "user", content: message },
      ];

      const res = await callOpenRouter({
        model: id,
        messages: promptMessages,
        max_tokens: 450,
        temperature: 0.4,
        returnMetadata: true,
      });

      if (onProgress) onProgress({ status: "model_done", model: res.model || id, label });
      return {
        id: res.model || id,
        label,
        specialty,
        response: res.content,
        latencyMs: Date.now() - t0,
        success: true,
      };
    } catch (err) {
      console.warn(`[CouncilOfAI] Model ${id} failed:`, err.message);
      return { id, label, specialty, error: err.message, latencyMs: Date.now() - t0, success: false };
    }
  });

  const councilResults = await Promise.all(modelPromises);
  const successfulPerspectives = councilResults.filter((r) => r.success);

  if (successfulPerspectives.length === 0) {
    throw new Error("All council models failed to generate responses.");
  }

  // If only 1 succeeded, return it directly without an extra synthesis hop to stay fast
  if (successfulPerspectives.length === 1) {
    return {
      masterAnswer: successfulPerspectives[0].response,
      perspectives: councilResults,
      consensusCount: 1,
      synthesisModel: successfulPerspectives[0].id,
      totalLatencyMs: Date.now() - tStartAll,
    };
  }

  if (onProgress) onProgress({ status: "synthesizing", model: synthesisModel });

  const perspectivesFormatted = successfulPerspectives
    .map((r, i) => `### Specialist ${i + 1}: ${r.label} (${r.specialty}, ${r.latencyMs}ms)\n${r.response}`)
    .join("\n\n---\n\n");

  const synthesisUserPrompt = `User Query: "${message}"

${successfulPerspectives.length} specialized frontier models analyzed the query in parallel:
${perspectivesFormatted}

TASK: Combine the strongest, most accurate elements from ALL specialists into ONE definitive, superior Master Answer:
1. Merge the best technical details, code, facts, and reasoning from each model.
2. Eliminate any weak, redundant, or contradicted claims.
3. Deliver a crisp, well-structured, high-impact response addressed respectfully to "sir".`;

  const synthesisResult = await callOpenRouter({
    model: synthesisModel,
    messages: [
      { role: "system", content: siaIdentity.systemPrompt() },
      { role: "user", content: synthesisUserPrompt },
    ],
    max_tokens: 750,
    temperature: 0.35,
    returnMetadata: true,
  });

  return {
    masterAnswer: synthesisResult.content,
    perspectives: councilResults,
    consensusCount: successfulPerspectives.length,
    synthesisModel: synthesisResult.model || synthesisModel,
    totalLatencyMs: Date.now() - tStartAll,
  };
}

/**
 * Fast 2-model Super-Blend Fusion: pairs the best Reasoning model + best Speed/Code specialist
 * for maximum intelligence with low latency.
 */
async function runSuperBlend({ message, history = [], onProgress }) {
  const freeTier = isFreeTierAccount();
  const isCoding = /\b(code|bug|debug|function|script|api|python|javascript|typescript|react|sql|algorithm|refactor|html|css)\b/i.test(message);

  const pair = freeTier
    ? [
        {
          id: "nvidia/nemotron-3-ultra-550b-a55b:free",
          label: "Nemotron 3 Ultra 550B",
          specialty: "Deep Reasoning & Architecture",
        },
        isCoding
          ? {
              id: "cohere/north-mini-code:free",
              label: "Cohere North Mini Code",
              specialty: "Code Generation & Bug-Free Implementation",
            }
          : {
              id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
              label: "Nemotron 3 Nano Omni",
              specialty: "Ultra-Fast Precision Verification",
            },
      ]
    : [
        isCoding
          ? { id: "anthropic/claude-sonnet-5.5", label: "Claude Sonnet 5.5", specialty: "Code Architecture" }
          : { id: "openai/gpt-6.1-terra", label: "GPT-6.1 Terra", specialty: "Omni Reasoning" },
        { id: "deepseek/deepseek-v4.1-flash", label: "DeepSeek V4.1 Flash", specialty: "Fast STEM & Logic" },
      ];

  return runCouncilConsensus({ message, history, onProgress, modelsOverride: pair });
}

module.exports = {
  runCouncilConsensus,
  runSuperBlend,
  getCouncilConfig,
  FREE_COUNCIL_MODELS,
  PAID_COUNCIL_MODELS,
  COUNCIL_MODELS: FREE_COUNCIL_MODELS,
};
