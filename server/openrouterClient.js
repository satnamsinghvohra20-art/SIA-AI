const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const FALLBACK_MODELS = [
  "openai/gpt-4o-mini",
  "meta-llama/llama-3.3-70b-instruct",
  "deepseek/deepseek-chat",
  "google/gemini-2.0-flash-001",
  "qwen/qwen-2.5-72b-instruct",
];

const FALLBACK_TOOL_MODELS = [
  "openai/gpt-4o-mini",
  "meta-llama/llama-3.3-70b-instruct",
  "deepseek/deepseek-chat",
  "google/gemini-2.0-flash-001",
];

// In-memory cache for quarantined / broken models (30 min TTL)
const deadModelCache = new Map(); // modelName -> timestamp of expiration
const QUARANTINE_DURATION_MS = 30 * 60 * 1000;

function isModelQuarantined(model) {
  const expiresAt = deadModelCache.get(model);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    deadModelCache.delete(model);
    return false;
  }
  return true;
}

function quarantineModel(model, reason) {
  console.warn(`[OpenRouter Health] Quarantining broken model "${model}" for 30m. Reason: ${reason}`);
  deadModelCache.set(model, Date.now() + QUARANTINE_DURATION_MS);
}

/**
 * Executes a fetch with an AbortSignal timeout.
 */
async function fetchWithTimeout(url, options, timeoutMs = 8000) {
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
 * with smart health caching & zero-downtime sub-second failover.
 */
async function callOpenRouter({ model, messages, max_tokens = 4096, temperature = 0.7 }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY. Add it to your .env file.");
  }

  const candidatePool = [model, ...FALLBACK_MODELS.filter((m) => m !== model)];
  const activeCandidates = candidatePool.filter((m) => !isModelQuarantined(m));
  const modelsToTry = activeCandidates.length > 0 ? activeCandidates : candidatePool;
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
        10000
      );

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        if (response.status === 402 || response.status === 404 || response.status === 400) {
          quarantineModel(currentModel, `${response.status}: ${errText.slice(0, 100)}`);
        }
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
 * Tool-calling flow for device control with smart health caching & rapid failover.
 */
async function callOpenRouterWithTools({ model, messages, tools, max_tokens = 2048, temperature = 0.2 }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY. Add it to your .env file.");
  }

  const candidatePool = [model, ...FALLBACK_TOOL_MODELS.filter((m) => m !== model)];
  const activeCandidates = candidatePool.filter((m) => !isModelQuarantined(m));
  const modelsToTry = activeCandidates.length > 0 ? activeCandidates : candidatePool;
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
        9000
      );

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        if (response.status === 402 || response.status === 404 || response.status === 400) {
          quarantineModel(currentModel, `${response.status}: ${errText.slice(0, 100)}`);
        }
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
