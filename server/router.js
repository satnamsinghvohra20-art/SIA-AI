const { classify } = require("./classifier");
const { MODEL_REGISTRY } = require("./modelRegistry");
const { callOpenRouter } = require("./openrouterClient");

/**
 * ROUTER
 * ------
 * The main orchestration function:
 *   1. classify the incoming task
 *   2. look up the best model for that category
 *   3. call it
 *   4. return the answer + which model/category was used (for transparency)
 */
async function route({ message, history = [], forceCategory = null }) {
  const { category, method } = forceCategory
    ? { category: forceCategory, method: "manual" }
    : await classify(message);

  const entry = MODEL_REGISTRY[category] || MODEL_REGISTRY.default;

  const messages = [
    ...history,
    { role: "user", content: message },
  ];

  const answer = await callOpenRouter({
    model: entry.model,
    messages,
  });

  return {
    answer,
    routing: {
      category,
      classifiedBy: method,
      model: entry.model,
      modelLabel: entry.label,
      why: entry.why,
    },
  };
}

module.exports = { route };
