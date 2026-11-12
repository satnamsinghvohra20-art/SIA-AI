const { classify } = require("./classifier");
const { MODEL_REGISTRY, getModelForCategory } = require("./modelRegistry");
const { callOpenRouter, isFreeTierAccount, refreshAccountTier } = require("./openrouterClient");
const { runSuperBlend } = require("./consensusEngine");
const siaIdentity = require("./siaIdentity");
const { getModelByIdSync, matchBestModelFrom300 } = require("./modelsCatalog");

/**
 * ROUTER
 * ------
 * The main orchestration function:
 *   1. Ensure account tier (free vs paid) is known so 0ms is wasted on 402s
 *   2. Handle Super-Blend Multi-Model Fusion when requested
 *   3. Classify task & match the #1 working model from 460+ live models
 *   4. Call with Sia's identity system prompt & return answer + routing metadata
 */
async function route({ message, history = [], forceCategory = null, forceModel = null }) {
  await refreshAccountTier();
  const freeTier = isFreeTierAccount();

  if (!forceModel && forceCategory === "super_blend") {
    const blend = await runSuperBlend({ message, history });
    return {
      answer: blend.masterAnswer,
      routing: {
        category: "super_blend",
        classifiedBy: "multi_model_fusion",
        model: blend.synthesisModel,
        modelLabel: `⚡ Super-Blend Fusion (${blend.consensusCount} Models · ${blend.totalLatencyMs}ms)`,
        why: "Combined multiple top AI specialists in parallel and synthesized the strongest verified answer.",
      },
      perspectives: blend.perspectives,
    };
  }

  let targetModel = null;
  let modelLabel = null;
  let categoryName = "general";
  let classifiedBy = "460_model_matcher";
  let why = "Auto-selected #1 working AI model";

  if (forceModel) {
    targetModel = forceModel;
    const catEntry = getModelByIdSync(forceModel);
    modelLabel = catEntry ? catEntry.name : forceModel;
    categoryName = catEntry?.category || "custom";
    classifiedBy = "user_override";
    why = `Manually selected model: ${modelLabel}`;
  } else if (forceCategory && MODEL_REGISTRY[forceCategory]) {
    const entry = getModelForCategory(forceCategory, { freeTier });
    targetModel = entry.model;
    modelLabel = entry.label;
    categoryName = forceCategory;
    classifiedBy = "category_override";
    why = entry.why;
  } else {
    const classification = await classify(message);
    if (classification.category === "device_control") {
      const entry = getModelForCategory("device_control", { freeTier });
      targetModel = entry.model;
      modelLabel = entry.label;
      categoryName = "device_control";
      classifiedBy = classification.method;
      why = entry.why;
    } else {
      const bestMatch = matchBestModelFrom300(message, { freeTierOnly: freeTier });
      targetModel = bestMatch.model;
      modelLabel = bestMatch.modelLabel;
      categoryName = bestMatch.category;
      classifiedBy = "460_model_matcher";
      why = bestMatch.why;
    }
  }

  const messages = [
    { role: "system", content: siaIdentity.systemPrompt() },
    ...history,
    { role: "user", content: message },
  ];

  const res = await callOpenRouter({
    model: targetModel,
    messages,
    strictModel: Boolean(forceModel),
    returnMetadata: true,
  });

  return {
    answer: res.content,
    routing: {
      category: categoryName,
      classifiedBy,
      model: res.model || targetModel,
      modelLabel,
      latencyMs: res.latencyMs,
      why,
    },
  };
}

module.exports = { route, getModelForCategory };
