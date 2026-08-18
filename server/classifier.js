const { callOpenRouter } = require("./openrouterClient");

/**
 * CLASSIFIER
 * ----------
 * Decides which task category a user's message belongs to.
 *
 * Two modes:
 *  1. Heuristic (instant, free, no API call) — keyword-based, runs first.
 *  2. LLM fallback (only if heuristic is unsure) — uses a cheap/fast model
 *     to classify ambiguous prompts.
 */

const CATEGORY_KEYWORDS = {
  coding: [
    "code", "function", "bug", "error", "debug", "python", "javascript",
    "react", "api", "class ", "compile", "stack trace", "refactor",
    "sql", "algorithm", "script", "repo", "git", "regex",
  ],
  reasoning: [
    "prove", "solve", "logic", "puzzle", "step by step", "theorem",
    "probability", "math", "equation", "calculate", "derive",
  ],
  creative: [
    "story", "poem", "write a", "essay", "novel", "screenplay",
    "creative", "song", "lyrics", "character", "plot",
  ],
  research: [
    "latest", "news", "current", "today", "who is", "what happened",
    "search", "find out", "recent", "price of", "stock",
  ],
  vision: [
    "image", "photo", "picture", "screenshot", "diagram", "chart",
    "看", "look at this", "attached image",
  ],
  long_context: [
    "entire document", "whole book", "full codebase", "long pdf",
    "summarize this document", "analyze this contract",
  ],
  data: [
    "json", "csv", "spreadsheet", "table", "extract fields",
    "structured data", "schema",
  ],
  fast_general: [
    "hi", "hello", "hey", "thanks", "what's up", "quick question",
  ],
  // Not used to route /api/chat (device tasks go through the dedicated
  // /api/device/command endpoint) — kept here so a plain chat message like
  // "open chrome for me" gets classified sensibly if it ever reaches the
  // normal chat path instead of the device panel.
  device_control: [
    "open app", "close app", "turn on", "turn off", "shut down", "shutdown",
    "restart my", "set volume", "take a screenshot", "send a whatsapp",
    "send whatsapp", "message on instagram", "call my", "place a call",
    "run the script", "delete the file", "control my device", "control my pc",
    "control my computer", "control my phone",
  ],
};

function heuristicClassify(text) {
  const lower = text.toLowerCase();
  let bestCategory = null;
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.filter((kw) => lower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  // Require at least one real signal before trusting the heuristic
  return bestScore > 0 ? bestCategory : null;
}

async function llmClassify(text) {
  const categories = Object.keys(require("./modelRegistry").MODEL_REGISTRY).filter(
    (c) => c !== "default"
  );

  const systemPrompt = `You are a task router. Classify the user's message into exactly one of these categories: ${categories.join(
    ", "
  )}. Reply with ONLY the category name, nothing else.`;

  try {
    const result = await callOpenRouter({
      model: "google/gemini-2.5-flash", // cheap + fast for a one-word classification
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
      max_tokens: 10,
    });
    const guess = result.trim().toLowerCase().replace(/[^a-z_]/g, "");
    return categories.includes(guess) ? guess : "default";
  } catch (err) {
    console.error("Classifier LLM fallback failed:", err.message);
    return "default";
  }
}

async function classify(text) {
  const heuristicGuess = heuristicClassify(text);
  if (heuristicGuess) {
    return { category: heuristicGuess, method: "heuristic" };
  }
  const llmGuess = await llmClassify(text);
  return { category: llmGuess, method: "llm" };
}

module.exports = { classify };
