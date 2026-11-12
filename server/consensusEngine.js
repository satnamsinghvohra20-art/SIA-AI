const { callOpenRouter } = require("./openrouterClient");
const { MODEL_REGISTRY } = require("./modelRegistry");
const siaIdentity = require("./siaIdentity");

const COUNCIL_MODELS = [
  { id: MODEL_REGISTRY.coding.model, label: MODEL_REGISTRY.coding.label, specialty: "Coding and implementation" },
  { id: MODEL_REGISTRY.vision.model, label: MODEL_REGISTRY.vision.label, specialty: "Multimodal analysis" },
  { id: MODEL_REGISTRY.fast_reasoning.model, label: MODEL_REGISTRY.fast_reasoning.label, specialty: "Fast reasoning" },
];

const SYNTHESIS_MODEL = MODEL_REGISTRY.default.model;

/**
 * Runs multi-model consensus deliberation.
 * Queries 3 distinct top frontier AI models in parallel, then synthesizes a unified master answer.
 */
async function runCouncilConsensus({ message, history = [], onProgress }) {
  if (onProgress) onProgress({ status: "dispatching", models: COUNCIL_MODELS });

  // 1. Dispatch queries in parallel with individual error resilience
  const modelPromises = COUNCIL_MODELS.map(async ({ id, label, specialty }) => {
    try {
      if (onProgress) onProgress({ status: "model_start", model: id, label });
      const promptMessages = [
        {
          role: "system",
          content: `You are an elite expert advisor in a multi-model council. Provide your deepest, most rigorous, and independent perspective on the user's inquiry. Focus on your strength (${specialty}). Be concise and insightful (under 120 words).`,
        },
        ...history.slice(-4),
        { role: "user", content: message },
      ];

      const response = await callOpenRouter({
        model: id,
        messages: promptMessages,
        max_tokens: 350,
        temperature: 0.5,
      });

      if (onProgress) onProgress({ status: "model_done", model: id, label });
      return { id, label, specialty, response, success: true };
    } catch (err) {
      console.warn(`[CouncilOfAI] Model ${id} failed:`, err.message);
      return { id, label, specialty, error: err.message, success: false };
    }
  });

  const councilResults = await Promise.all(modelPromises);
  const successfulPerspectives = councilResults.filter((r) => r.success);

  if (successfulPerspectives.length === 0) {
    throw new Error("All council models failed to generate responses.");
  }

  // 2. Synthesize Master Consensus via Sia's Synthesis Agent
  if (onProgress) onProgress({ status: "synthesizing" });

  const perspectivesFormatted = successfulPerspectives
    .map(
      (r, i) => `### Perspective ${i + 1}: ${r.label} (${r.specialty})\n${r.response}`
    )
    .join("\n\n---\n\n");

  const synthesisPrompt = `${siaIdentity.systemPrompt()}

You are leading the Council of AI. Three frontier models evaluated the following user prompt:

User Query: "${message}"

Here are their individual independent analyses:
${perspectivesFormatted}

TASK: Deliver Sia's definitive Master Synthesis for the user:
1. State the core unanimous consensus in 1-2 authoritative sentences.
2. Synthesize key insights and resolve any discrepancies between the models.
3. Provide a clear, actionable verdict or solution.
Address the user respectfully as "sir". Keep formatting sharp, elegant, and highly structured.`;

  const masterAnswer = await callOpenRouter({
    model: SYNTHESIS_MODEL,
    messages: [{ role: "user", content: synthesisPrompt }],
    max_tokens: 500,
    temperature: 0.4,
  });

  return {
    masterAnswer,
    perspectives: councilResults,
    consensusCount: successfulPerspectives.length,
  };
}

module.exports = { runCouncilConsensus, COUNCIL_MODELS };
