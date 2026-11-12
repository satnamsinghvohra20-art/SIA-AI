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
const { getModelByIdSync } = require("./modelsCatalog");

function getModelForCategory(category) {
  const categoryName = MODEL_REGISTRY[category] ? category : "default";
  return {
    category: categoryName,
    ...MODEL_REGISTRY[categoryName],
  };
}

async function route({ message, history = [], forceCategory = null, forceModel = null }) {
  let targetModel = null;
  let modelLabel = null;
  let categoryName = "general";
  let classifiedBy = "task_classifier";
  let why = "Selected a model using the task classifier's specialist mapping.";

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
    const classification = await classify(message);
    const entry = getModelForCategory(classification.category);
    targetModel = entry.model;
    modelLabel = entry.label;
    categoryName = entry.category;
    classifiedBy = classification.method;
    why = entry.why;
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

module.exports = { route, getModelForCategory };
