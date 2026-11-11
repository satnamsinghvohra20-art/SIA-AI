const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const FALLBACK_MODELS = [
  "openai/gpt-4o-mini",
  "google/gemini-2.5-flash",
  "deepseek/deepseek-chat",
  "openai/gpt-5.4-mini",
  "anthropic/claude-sonnet-5",
  "anthropic/claude-haiku-4.5",
  "meta-llama/llama-3.3-70b-instruct",
  "openrouter/free",
  "nvidia/nemotron-3-super-120b-a12b:free",
];

const FALLBACK_TOOL_MODELS = [
  "openai/gpt-4o-mini",
  "openai/gpt-5.4-mini",
  "google/gemini-2.5-flash",
  "anthropic/claude-sonnet-5",
  "anthropic/claude-haiku-4.5",
  "openrouter/free",
];

const DEFAULT_MAX_TOKENS = 500;

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
  max_tokens = 500,
  temperature = 0.7,
  onChunk,
  signal,
  timeoutMs = 60000,
}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY. Add it to your .env file.");
  }

  const candidatePool = [model, ...FALLBACK_MODELS.filter((m) => m !== model)];
  const activeCandidates = candidatePool.filter((m) => !isModelQuarantined(m));
  const modelsToTry = activeCandidates.length > 0 ? activeCandidates : candidatePool;
  let lastError = null;
  let emittedOutput = false;

  for (const currentModel of modelsToTry) {
    let effectiveMaxTokens = max_tokens;
    const controller = new AbortController();
    const abortFromCaller = () => controller.abort(signal?.reason);
    if (signal?.aborted) abortFromCaller();
    else signal?.addEventListener("abort", abortFromCaller, { once: true });
    const timeoutId = setTimeout(() => controller.abort(new Error("OpenRouter stream timed out.")), timeoutMs);
    try {
      let response = await fetch(OPENROUTER_URL, {
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
          max_tokens: effectiveMaxTokens,
          temperature,
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        // Check for affordable tokens in 402 error (e.g. "can only afford 1687")
        const affordMatch = errText.match(/can only afford (\d+)/i);
        if (affordMatch && Number(affordMatch[1]) > 50) {
          effectiveMaxTokens = Math.max(50, Number(affordMatch[1]) - 20);
          console.log(`[OpenRouter Stream] Adapting max_tokens to ${effectiveMaxTokens} for ${currentModel}`);
          response = await fetch(OPENROUTER_URL, {
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
              max_tokens: effectiveMaxTokens,
              temperature,
              stream: true,
            }),
            signal: controller.signal,
          });
        }
        if (!response.ok) {
          if (response.status === 404 || response.status === 410) {
            quarantineModel(currentModel, `${response.status}: ${errText.slice(0, 100)}`);
          }
          throw new Error(`Model ${currentModel} stream returned ${response.status}: ${errText.slice(0, 200)}`);
        }
      }

      if (!response.body) {
        throw new Error(`Model ${currentModel} returned empty streaming body.`);
      }

      // Stream reader with SSE line parser
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let fullContent = "";
      let fullReasoning = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const jsonStr = trimmed.slice(6);
          if (jsonStr === "[DONE]") continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta;
            if (!delta) continue;

            // Extract normal content
            if (delta.content) {
              fullContent += delta.content;
              emittedOutput = true;
              if (onChunk) onChunk({ type: "token", content: delta.content, model: currentModel });
            }

            // Extract reasoning content (DeepSeek R1, Claude Thinking, etc.)
            const reasoning = delta.reasoning_content || delta.reasoning;
            if (reasoning) {
              fullReasoning += reasoning;
              emittedOutput = true;
              if (onChunk) onChunk({ type: "reasoning", text: reasoning, model: currentModel });
            }
          } catch (_) {}
        }
      }

      if (onChunk) {
        onChunk({
          type: "done",
          content: fullContent,
          reasoning: fullReasoning,
          model: currentModel,
          done: true,
        });
      }

      return {
        answer: fullContent,
        reasoning: fullReasoning,
        model: currentModel,
      };
    } catch (err) {
      console.warn(`[OpenRouter Stream] Model ${currentModel} failed (${err.message}). Attempting failover...`);
      lastError = err;
      if (signal?.aborted) throw err;
      // Once tokens have reached the user, switching models would splice two
      // different answers together. Stop and report the interrupted stream.
      if (emittedOutput) throw err;
    } finally {
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", abortFromCaller);
    }
  }

  // 100% Offline / Zero-Cost Sovereign Fallback
  console.log("[OpenRouter Stream] Cloud models exhausted. Falling back to Sovereign Local Cognitive Engine...");
  const { generateLocalFallback } = require("./localBrain");
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content || "";
  const localResult = await generateLocalFallback({ message: typeof lastUserMsg === "string" ? lastUserMsg : "Hello" });

  if (onChunk) {
    onChunk({ type: "token", content: localResult.answer, model: localResult.routing.modelLabel });
    onChunk({
      type: "done",
      content: localResult.answer,
      reasoning: "",
      model: localResult.routing.modelLabel,
      done: true,
    });
  }

  return {
    answer: localResult.answer,
    reasoning: "",
    model: localResult.routing.modelLabel,
  };
}

/**
 * Standard non-streaming chat completion.
 */
async function callOpenRouter({
  model,
  messages,
  max_tokens = 500,
  temperature = 0.7,
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
    let effectiveMaxTokens = max_tokens;
    try {
      let response = await fetchWithTimeout(
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
            max_tokens: effectiveMaxTokens,
            temperature,
          }),
        },
        10000
      );

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        const affordMatch = errText.match(/can only afford (\d+)/i);
        if (affordMatch && Number(affordMatch[1]) > 50) {
          effectiveMaxTokens = Math.max(50, Number(affordMatch[1]) - 20);
          console.log(`[OpenRouter] Adapting max_tokens to ${effectiveMaxTokens} for ${currentModel}`);
          response = await fetchWithTimeout(
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
                max_tokens: effectiveMaxTokens,
                temperature,
              }),
            },
            10000
          );
        }
        if (!response.ok) {
          // Only quarantine if model is permanently deleted/unavailable (404/410), never for credit/token limit (402)
          if (response.status === 404 || response.status === 410) {
            quarantineModel(currentModel, `${response.status}: ${errText.slice(0, 100)}`);
          }
          throw new Error(`Model ${currentModel} returned ${response.status}: ${errText.slice(0, 200)}`);
        }
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

  // 100% Offline / Zero-Cost Sovereign Fallback
  console.log("[OpenRouter Non-Stream] Cloud models exhausted. Falling back to Sovereign Local Cognitive Engine...");
  const { generateLocalFallback } = require("./localBrain");
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content || "";
  const localResult = await generateLocalFallback({ message: typeof lastUserMsg === "string" ? lastUserMsg : "Hello" });
  return localResult.answer;
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
