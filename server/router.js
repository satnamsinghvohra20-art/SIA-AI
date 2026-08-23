const { classify } = require("./classifier");
const { MODEL_REGISTRY } = require("./modelRegistry");
const { callOpenRouter } = require("./openrouterClient");
const siaIdentity = require("./siaIdentity");

/**
 * ROUTER
 * ------
 * The main orchestration function:
 *   1. classify the incoming task
 *   2. look up the best model for that category
 *   3. call it — WITH Sia's own capability system prompt prepended, so
 *      whichever model answers knows what Sia can actually do (see
 *      siaIdentity.js — this is what fixes "it says it doesn't know
 *      WhatsApp": previously nothing told the model Sia has that ability)
 *   4. return the answer + which model/category was used (for transparency)
 */
const { getModelByIdSync, matchBestModelFrom300 } = require("./modelsCatalog");

async function route({ message, history = [], forceCategory = null, forceModel = null }) {
  let targetModel = null;
  let modelLabel = null;
  let categoryName = "general";
  let classifiedBy = "300_model_matcher";
  let why = "Auto-selected #1 AI model among 300+ models";

  if (forceModel) {
    targetModel = forceModel;
    const catEntry = getModelByIdSync(forceModel);
    modelLabel = catEntry ? catEntry.name : forceModel;
    categoryName = catEntry?.category || "custom";
    classifiedBy = "user_override";
    why = `Manually selected model: ${modelLabel}`;
  } else if (forceCategory && MODEL_REGISTRY[forceCategory]) {
    const entry = MODEL_REGISTRY[forceCategory];
    targetModel = entry.model;
    modelLabel = entry.label;
    categoryName = forceCategory;
    classifiedBy = "category_override";
    why = entry.why;
  } else {
    // 300+ AI Models Intelligent Matcher
    const classification = await classify(message);
    if (classification.category === "device_control") {
      const entry = MODEL_REGISTRY.device_control;
      targetModel = entry.model;
      modelLabel = entry.label;
      categoryName = "device_control";
      classifiedBy = classification.method;
      why = entry.why;
    } else {
      const bestMatch = matchBestModelFrom300(message);
      targetModel = bestMatch.model;
      modelLabel = bestMatch.modelLabel;
      categoryName = bestMatch.category;
      classifiedBy = "300_model_matcher";
      why = bestMatch.why;
    }
  }

  const messages = [
    { role: "system", content: siaIdentity.systemPrompt() },
    ...history,
    { role: "user", content: message },
  ];

  const answer = await callOpenRouter({
    model: targetModel,
    messages,
  });

  return {
    answer,
    routing: {
      category: categoryName,
      classifiedBy,
      model: targetModel,
      modelLabel,
      why,
    },
  };
}

module.exports = { route };
