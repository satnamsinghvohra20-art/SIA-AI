const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const FALLBACK_MODELS = [
  "openai/gpt-4o-mini",
  "openai/gpt-5.4-mini",
  "deepseek/deepseek-chat",
  "meta-llama/llama-3.3-70b-instruct",
  "google/gemini-2.5-flash",
  "qwen/qwen-2.5-72b-instruct",
];

const FALLBACK_TOOL_MODELS = [
  "openai/gpt-4o-mini",
  "openai/gpt-5.4-mini",
  "deepseek/deepseek-chat",
  "google/gemini-2.5-flash",
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
 * Streams chat completions from OpenRouter via Server-Sent Events (SSE).
 * Calls onChunk({ content, reasoning, model, done }) as tokens arrive.
 * Automatically handles reasoning_content / <think> tags for reasoning models.
 */
async function streamOpenRouterCompletion({
  model,
  messages,
  max_tokens = 4096,
  temperature = 0.7,
  onChunk,
}) {
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
      const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
          "X-Title": "Sia AI Autonomous Orchestrator",
        },
        body: JSON.stringify({
          model: currentModel,
          messages,
          max_tokens,
          temperature,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        if (response.status === 402 || response.status === 404 || response.status === 400) {
          quarantineModel(currentModel, `${response.status}: ${errText.slice(0, 100)}`);
        }
        throw new Error(`Model ${currentModel} stream returned ${response.status}: ${errText.slice(0, 200)}`);
      }

      if (!response.body) {
        throw new Error(`Model ${currentModel} returned no readable stream body`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let fullContent = "";
      let fullReasoning = "";
      let inThinkTag = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;
          const dataStr = trimmed.replace(/^data:\s*/, "");
          if (dataStr === "[DONE]") {
            if (onChunk) onChunk({ done: true, fullContent, fullReasoning, model: currentModel });
            return { content: fullContent, reasoning: fullReasoning, model: currentModel };
          }

          try {
            const parsed = JSON.parse(dataStr);
            const delta = parsed?.choices?.[0]?.delta;
            if (!delta) continue;

            // 1. Direct reasoning_content from OpenRouter (DeepSeek R1, Gemini Thinking, Claude 3.7)
            const reasoningDelta = delta.reasoning_content || delta.reasoning || "";
            if (reasoningDelta) {
              fullReasoning += reasoningDelta;
              if (onChunk) onChunk({ reasoning: reasoningDelta, model: currentModel, done: false });
            }

            // 2. Standard content delta (check for <think> tags)
            const contentDelta = delta.content || "";
            if (contentDelta) {
              if (contentDelta.includes("<think>")) {
                inThinkTag = true;
                const parts = contentDelta.split("<think>");
                if (parts[0]) {
                  fullContent += parts[0];
                  if (onChunk) onChunk({ content: parts[0], model: currentModel, done: false });
                }
                if (parts[1]) {
                  fullReasoning += parts[1];
                  if (onChunk) onChunk({ reasoning: parts[1], model: currentModel, done: false });
                }
              } else if (contentDelta.includes("</think>")) {
                inThinkTag = false;
                const parts = contentDelta.split("</think>");
                if (parts[0]) {
                  fullReasoning += parts[0];
                  if (onChunk) onChunk({ reasoning: parts[0], model: currentModel, done: false });
                }
                if (parts[1]) {
                  fullContent += parts[1];
                  if (onChunk) onChunk({ content: parts[1], model: currentModel, done: false });
                }
              } else if (inThinkTag) {
                fullReasoning += contentDelta;
                if (onChunk) onChunk({ reasoning: contentDelta, model: currentModel, done: false });
              } else {
                fullContent += contentDelta;
                if (onChunk) onChunk({ content: contentDelta, model: currentModel, done: false });
              }
            }
          } catch (parseErr) {
            // Partial JSON chunk line, ignore and continue
          }
        }
      }

      if (onChunk) onChunk({ done: true, fullContent, fullReasoning, model: currentModel });
      return { content: fullContent, reasoning: fullReasoning, model: currentModel };
    } catch (err) {
      console.warn(`[OpenRouter Stream] Model ${currentModel} stream failed (${err.message}). Trying failover...`);
      lastError = err;
    }
  }

  throw new Error(`All candidate AI models failed to stream. Last error: ${lastError?.message}`);
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
            "X-Title": "Sia AI Autonomous Orchestrator",
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
            "X-Title": "Sia AI Autonomous Orchestrator",
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

module.exports = { callOpenRouter, callOpenRouterWithTools, streamOpenRouterCompletion };
