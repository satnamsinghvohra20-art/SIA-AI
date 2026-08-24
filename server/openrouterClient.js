const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const FALLBACK_MODELS = [
  "openai/gpt-4o-mini",
  "openrouter/free",
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3.5-lightning:free",
  "meta-llama/llama-3.3-70b-instruct",
  "deepseek/deepseek-chat",
];

const FALLBACK_TOOL_MODELS = [
  "openai/gpt-4o-mini",
  "openrouter/free",
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3.5-lightning:free",
  "meta-llama/llama-3.3-70b-instruct",
  "deepseek/deepseek-chat",
];

/**
 * Executes a fetch with an AbortSignal timeout.
 */
async function fetchWithTimeout(url, options, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Thin wrapper around OpenRouter unified chat completions endpoint
 * with automatic zero-downtime failover if a primary model is unavailable.
 */
async function callOpenRouter({ model, messages, max_tokens = 700, temperature = 0.7 }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing OPENROUTER_API_KEY. Add it to your .env file."
    );
  }

  const modelsToTry = [model, ...FALLBACK_MODELS.filter((m) => m !== model)];
  let lastError = null;

  for (const currentModel of modelsToTry) {
    try {
      const response = await fetchWithTimeout(
        OPENROUTER_URL,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
            "X-Title": "Sia / J.A.R.V.I.S. Orchestrator",
          },
          body: JSON.stringify({
            model: currentModel,
            messages,
            max_tokens,
            temperature,
          }),
        },
        18000
      );

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(`Model ${currentModel} returned ${response.status}: ${errText.slice(0, 200)}`);
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error(`Model ${currentModel} returned empty content`);
      }

      return content;
    } catch (err) {
      console.warn(`[OpenRouter] Model ${currentModel} failed (${err.message}). Attempting failover...`);
      lastError = err;
    }
  }

  throw new Error(`All candidate AI models failed. Last error: ${lastError?.message}`);
}

/**
 * Tool-calling flow for device control with automatic tool-capable model failover.
 */
async function callOpenRouterWithTools({ model, messages, tools, max_tokens = 800, temperature = 0.2 }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing OPENROUTER_API_KEY. Add it to your .env file."
    );
  }

  const modelsToTry = [model, ...FALLBACK_TOOL_MODELS.filter((m) => m !== model)];
  let lastError = null;

  for (const currentModel of modelsToTry) {
    try {
      const response = await fetchWithTimeout(
        OPENROUTER_URL,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
            "X-Title": "Sia / J.A.R.V.I.S. Orchestrator",
          },
          body: JSON.stringify({
            model: currentModel,
            messages,
            tools,
            max_tokens,
            temperature,
          }),
        },
        22000
      );

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(`Tool Model ${currentModel} returned ${response.status}: ${errText.slice(0, 200)}`);
      }

      const data = await response.json();
      const message = data?.choices?.[0]?.message;
      if (!message) {
        throw new Error(`Tool Model ${currentModel} returned empty message`);
      }

      return message;
    } catch (err) {
      console.warn(`[OpenRouter ToolAgent] Model ${currentModel} failed (${err.message}). Attempting failover...`);
      lastError = err;
    }
  }

  throw new Error(`All candidate tool models failed. Last error: ${lastError?.message}`);
}

module.exports = { callOpenRouter, callOpenRouterWithTools };
