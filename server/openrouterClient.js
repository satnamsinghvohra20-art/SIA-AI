const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_KEY_URL = "https://openrouter.ai/api/v1/auth/key";

// Verified live 2026 free models on OpenRouter (benchmarked HTTP 200 OK & non-empty content)
// Ordered by empirical reliability, non-empty output, and measured speed.
const FREE_FALLBACK_MODELS = [
  "cohere/north-mini-code:free",                        // ~2.5s 100% reliable, tools + coding + crisp answers
  "nvidia/nemotron-3-ultra-550b-a55b:free",             // ~3.4s 550B flagship MoE, 100% reliable
  "baidu/ernie-5.5-flash-preview:free",                 // 1M ctx multilingual & structured output
  "dots-studio/dots-3-note-preview:free",               // 512k multimodal creative
  "nvidia/nemotron-3.5-super-vl:free",                  // 1M multimodal VL
  "liquid/lfm-2.5-2.6b:free",                           // ultra-lightweight edge speed
  "openrouter/free",                                    // OpenRouter free auto-router
  "nvidia/nemotron-3.5-lightning:free",                 // 1M ctx (requires low reasoning effort or high max_tokens)
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", // omni-modal reasoning
];

const FREE_FALLBACK_TOOL_MODELS = [
  "cohere/north-mini-code:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "baidu/ernie-5.5-flash-preview:free",
  "nvidia/nemotron-3.5-lightning:free",
  "openrouter/free",
];

const FREE_FALLBACK_VISION_MODELS = [
  "nvidia/nemotron-3.5-super-vl:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "dots-studio/dots-3-note-preview:free",
  "openrouter/free",
];

// Live 2026 frontier paid models on OpenRouter (used when account has credits)
const PAID_FALLBACK_MODELS = [
  "openai/gpt-6-luna",
  "google/gemini-3.8-flash",
  "deepseek/deepseek-v4.1-flash",
  "anthropic/claude-haiku-5.5",
  "qwen/qwen3.7-flash",
  "anthropic/claude-sonnet-5.5",
  "meta-llama/llama-4-maverick",
  ...FREE_FALLBACK_MODELS,
];

const PAID_FALLBACK_TOOL_MODELS = [
  "openai/gpt-6-luna",
  "google/gemini-3.8-flash",
  "anthropic/claude-sonnet-5.5",
  "deepseek/deepseek-v4.1-flash",
  "anthropic/claude-haiku-5.5",
  ...FREE_FALLBACK_TOOL_MODELS,
];

const PAID_FALLBACK_VISION_MODELS = [
  "google/gemini-3.8-flash",
  "openai/gpt-6-luna",
  "anthropic/claude-sonnet-5.5",
  "deepseek/deepseek-v4.1-flash",
  ...FREE_FALLBACK_VISION_MODELS,
];

// Known permanent/harness-blocked models that should never be auto-selected
const BLOCKED_MODELS = new Set([
  "thinkingmachines/inkling-2-small:free",
]);

// Account tier detection cache
let accountTierState = {
  isFreeTier: true, // Safe optimistic default until verified, updated on startup / auth check / 402
  checkedAt: 0,
  creditsRemaining: null,
  freeDailyRemaining: null,
  neverPurchasedCredits: false,
  freeQuotaExhaustedUntil: 0,
};
const TIER_CACHE_TTL_MS = 2 * 60 * 1000;

// In-memory cache for quarantined / broken models: modelName -> { expiresAt, reason, status }
const deadModelCache = new Map();

// Live EWMA latency & health telemetry: modelName -> { calls, successes, failures, avgLatencyMs, lastLatencyMs, lastStatus, lastError, updatedAt }
const modelHealthStats = new Map();
const globalMetrics = {
  totalCalls: 0,
  totalSuccesses: 0,
  totalFailures: 0,
  retryCount: 0,
};

function isModelFree(modelId = "") {
  return modelId.endsWith(":free") || modelId === "openrouter/free";
}

function isFreeTierAccount() {
  return Boolean(accountTierState.isFreeTier || accountTierState.neverPurchasedCredits);
}

async function refreshAccountTier(force = false) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return accountTierState;

  const now = Date.now();
  if (!force && accountTierState.checkedAt > 0 && now - accountTierState.checkedAt < TIER_CACHE_TTL_MS) {
    return accountTierState;
  }

  try {
    const res = await fetchWithTimeout(
      OPENROUTER_KEY_URL,
      { headers: { Authorization: `Bearer ${apiKey}` } },
      5000
    );
    if (res.ok) {
      const json = await res.json();
      const d = json?.data || {};
      const isFree = Boolean(d.is_free_tier) && (d.limit_remaining === null || Number(d.limit_remaining) <= 0);
      accountTierState = {
        isFreeTier: isFree,
        checkedAt: now,
        creditsRemaining: d.limit_remaining ?? null,
        freeDailyRemaining: d.free_model_daily_requests?.remaining ?? null,
        neverPurchasedCredits: Boolean(d.is_free_tier),
      };
      console.log(
        `[OpenRouter Tier] Account mode: ${accountTierState.isFreeTier ? "FREE-FRONTIER ($0)" : "PAID-FRONTIER"}` +
        (accountTierState.freeDailyRemaining !== null ? ` (free daily remaining: ${accountTierState.freeDailyRemaining})` : "")
      );
    }
  } catch (err) {
    accountTierState.checkedAt = now - (TIER_CACHE_TTL_MS - 60 * 1000); // Retry after 60s instead of every call
    console.warn(`[OpenRouter Tier] Key check skipped: ${err.message}`);
  }
  return accountTierState;
}

function isModelQuarantined(model) {
  if (BLOCKED_MODELS.has(model)) return true;
  const entry = deadModelCache.get(model);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    deadModelCache.delete(model);
    return false;
  }
  return true;
}

function quarantineModel(model, reason, status = 0) {
  let ttlMs = 2 * 60 * 1000; // Default 2m for transient errors
  if (status === 404 || status === 410 || status === 403) {
    ttlMs = 60 * 60 * 1000; // 60m for missing/harness-locked models
  } else if (status === 402) {
    ttlMs = 30 * 60 * 1000; // 30m for unfunded paid models
  } else if (status === 429) {
    ttlMs = 90 * 1000; // 90s for upstream rate-limits so they recover fast
  }
  console.warn(`[OpenRouter Health] Quarantining "${model}" for ${Math.round(ttlMs / 1000)}s (${status || "err"}): ${reason}`);
  deadModelCache.set(model, { expiresAt: Date.now() + ttlMs, reason, status });
}

function recordModelOutcome(model, { ok, latencyMs, status = 200, error = null }) {
  globalMetrics.totalCalls += 1;
  if (ok) globalMetrics.totalSuccesses += 1;
  else globalMetrics.totalFailures += 1;

  const prev = modelHealthStats.get(model) || {
    calls: 0,
    successes: 0,
    failures: 0,
    avgLatencyMs: null,
    lastLatencyMs: null,
    lastStatus: null,
    lastError: null,
    updatedAt: 0,
  };
  const calls = prev.calls + 1;
  const successes = prev.successes + (ok ? 1 : 0);
  const failures = prev.failures + (ok ? 0 : 1);
  const avgLatencyMs =
    ok && typeof latencyMs === "number"
      ? prev.avgLatencyMs === null
        ? Math.round(latencyMs)
        : Math.round(prev.avgLatencyMs * 0.65 + latencyMs * 0.35)
      : prev.avgLatencyMs;

  modelHealthStats.set(model, {
    calls,
    successes,
    failures,
    avgLatencyMs,
    lastLatencyMs: latencyMs ?? prev.lastLatencyMs,
    lastStatus: status,
    lastError: ok ? null : (error || prev.lastError),
    updatedAt: Date.now(),
  });
}

function getModelScore(model) {
  const stat = modelHealthStats.get(model);
  if (!stat) return 0; // Neutral prior for untested models
  const successRate = stat.calls > 0 ? stat.successes / stat.calls : 1;
  const speedBonus = stat.avgLatencyMs ? Math.max(0, 2000 - stat.avgLatencyMs) / 200 : 0;
  return successRate * 100 + speedBonus - stat.failures * 15;
}

function getModelHealthReport() {
  const stats = {};
  for (const [id, s] of modelHealthStats.entries()) {
    stats[id] = {
      ...s,
      quarantined: isModelQuarantined(id),
    };
  }
  const quarantined = [];
  for (const [id, q] of deadModelCache.entries()) {
    if (Date.now() <= q.expiresAt) {
      quarantined.push({ id, status: q.status, reason: q.reason, remainingSec: Math.round((q.expiresAt - Date.now()) / 1000) });
    }
  }
  const completionRate =
    globalMetrics.totalCalls > 0
      ? Number(((globalMetrics.totalSuccesses / globalMetrics.totalCalls) * 100).toFixed(1))
      : 100;

  return {
    tier: isFreeTierAccount() ? "free" : "paid",
    account: accountTierState,
    summary: {
      ...globalMetrics,
      completionRatePct: completionRate,
      errorRatePct: Number((100 - completionRate).toFixed(1)),
    },
    quarantined,
    models: stats,
  };
}

/**
 * Maps a paid model ID to the closest verified working free specialist model
 * when the account is free-tier (avoids wasting 500ms+ on guaranteed 402s).
 */
function mapPaidToFreeSpecialist(model = "") {
  const id = model.toLowerCase();
  if (id.includes("vl") || id.includes("vision") || id.includes("image") || id.includes("pixtral")) {
    return "nvidia/nemotron-3.5-super-vl:free";
  }
  if (id.includes("code") || id.includes("coder") || id.includes("devstral") || id.includes("sonnet")) {
    return "cohere/north-mini-code:free";
  }
  if (id.includes("opus") || id.includes("o3") || id.includes("o4") || id.includes("r1") || id.includes("sol") || id.includes("pro") || id.includes("ultra") || id.includes("math")) {
    return "nvidia/nemotron-3-ultra-550b-a55b:free";
  }
  if (id.includes("luna") || id.includes("mini") || id.includes("nano") || id.includes("haiku") || id.includes("lite")) {
    return "cohere/north-mini-code:free";
  }
  if (id.includes("qwen") || id.includes("ernie")) {
    return "baidu/ernie-5.5-flash-preview:free";
  }
  if (id.includes("fable") || id.includes("grok") || id.includes("creative")) {
    return "dots-studio/dots-3-note-preview:free";
  }
  return "cohere/north-mini-code:free";
}

function messagesContainImages(messages = []) {
  return messages.some(
    (m) => Array.isArray(m?.content) && m.content.some((part) => part?.type === "image_url")
  );
}

/**
 * Builds an ordered, health-aware candidate list for a request.
 */
function buildCandidateModels({ requestedModel, messages = [], requireTools = false, strictModel = false }) {
  const hasImages = messagesContainImages(messages);
  const freeOnly = isFreeTierAccount();

  let fallbackPool;
  if (freeOnly) {
    fallbackPool = hasImages
      ? FREE_FALLBACK_VISION_MODELS
      : requireTools
        ? FREE_FALLBACK_TOOL_MODELS
        : FREE_FALLBACK_MODELS;
  } else {
    fallbackPool = hasImages
      ? PAID_FALLBACK_VISION_MODELS
      : requireTools
        ? PAID_FALLBACK_TOOL_MODELS
        : PAID_FALLBACK_MODELS;
  }

  let primary = requestedModel;
  if (freeOnly && primary && !isModelFree(primary) && !strictModel) {
    primary = mapPaidToFreeSpecialist(primary);
  }

  // Sort backups by live observed health & speed while preserving default order on ties
  const rankedBackups = [...fallbackPool].sort((a, b) => getModelScore(b) - getModelScore(a));
  const pool = primary ? [primary, ...rankedBackups.filter((m) => m !== primary)] : rankedBackups;

  const active = pool.filter((m) => !isModelQuarantined(m));
  return active.length > 0 ? active : pool.filter((m) => !BLOCKED_MODELS.has(m));
}

/**
 * Strips <think>...</think> blocks from complete text, returning { clean, reasoning }.
 */
function extractThinkBlocks(rawText = "") {
  let reasoning = "";
  const clean = String(rawText)
    .replace(/<think>([\s\S]*?)<\/think>/gi, (_, inner) => {
      reasoning += (reasoning ? "\n" : "") + inner.trim();
      return "";
    })
    .trim();
  return { clean: clean || rawText.trim(), reasoning };
}

/**
 * Executes a fetch with an AbortSignal timeout.
 */
async function fetchWithTimeout(url, options, timeoutMs = 10000, externalSignal = null) {
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort(externalSignal?.reason);
  if (externalSignal?.aborted) onExternalAbort();
  else externalSignal?.addEventListener("abort", onExternalAbort, { once: true });
  const timeoutId = setTimeout(() => controller.abort(new Error("Request timed out")), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", onExternalAbort);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", onExternalAbort);
    throw err;
  }
}

/**
 * Retries transient 5xx / network errors up to maxRetries with exponential backoff.
 */
async function fetchWithTransientRetry(makeFetch, { maxRetries = 1, baseDelayMs = 250, signal = null } = {}) {
  let attempt = 0;
  while (true) {
    try {
      const res = await makeFetch();
      if ((res.status >= 500 || res.status === 408) && attempt < maxRetries && !signal?.aborted) {
        attempt += 1;
        globalMetrics.retryCount += 1;
        await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, attempt - 1)));
        continue;
      }
      return res;
    } catch (err) {
      if (signal?.aborted || attempt >= maxRetries) throw err;
      attempt += 1;
      globalMetrics.retryCount += 1;
      await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, attempt - 1)));
    }
  }
}

function handleErrorStatus(currentModel, status, errText) {
  const lower = (errText || "").toLowerCase();
  if (status === 402 && (lower.includes("never purchased credits") || lower.includes("insufficient credits"))) {
    accountTierState.isFreeTier = true;
    accountTierState.neverPurchasedCredits = true;
    quarantineModel(currentModel, errText.slice(0, 120), 402);
  } else if (status === 429 && (lower.includes("free-models-per-day") || lower.includes("per-day"))) {
    accountTierState.freeDailyRemaining = 0;
    accountTierState.freeQuotaExhaustedUntil = Date.now() + 2 * 60 * 1000;
    quarantineModel(currentModel, "daily free quota exhausted", 429);
  } else if (status === 403 || status === 404 || status === 410 || status === 429 || status >= 500) {
    quarantineModel(currentModel, errText.slice(0, 120), status);
  }
}

function isFreeQuotaExhausted() {
  return (
    isFreeTierAccount() &&
    (accountTierState.freeDailyRemaining === 0 || Date.now() < (accountTierState.freeQuotaExhaustedUntil || 0))
  );
}

/**
 * Streams chat completions from OpenRouter via Server-Sent Events (SSE).
 * Calls onChunk({ type, content, text, model, done }) as tokens arrive.
 * Automatically routes <think>...</think> and reasoning_content to the reasoning channel.
 */
async function streamOpenRouterCompletion({
  model,
  messages,
  max_tokens = 1500,
  temperature = 0.7,
  onChunk,
  strictModel = false,
  deepReasoning = false,
  signal = null,
}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY. Add it to your .env file.");
  }

  // Ensure tier detection ran at least once
  if (accountTierState.checkedAt === 0) {
    await refreshAccountTier();
  }

  const modelsToTry = buildCandidateModels({ requestedModel: model, messages, strictModel });
  let lastError = null;

  for (const currentModel of modelsToTry) {
    if (signal?.aborted) throw new Error("Stream aborted by client.");
    if (isFreeQuotaExhausted() && isModelFree(currentModel)) {
      console.warn("[OpenRouter Stream] Daily free quota exhausted (0 remaining). Skipping wasted retries -> local engine.");
      break;
    }
    let effectiveMaxTokens = max_tokens;
    const tStart = Date.now();
    let emittedOutput = false;
    try {
      const makeRequest = (tokensLimit) =>
        fetchWithTimeout(
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
              max_tokens: tokensLimit,
              temperature,
              stream: true,
              ...(deepReasoning ? {} : { reasoning: { effort: "low" } }),
            }),
          },
          30000,
          signal
        );

      let response = await fetchWithTransientRetry(() => makeRequest(effectiveMaxTokens));

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        const affordMatch = errText.match(/can only afford (\d+)/i);
        if (affordMatch && Number(affordMatch[1]) > 50) {
          effectiveMaxTokens = Math.max(50, Number(affordMatch[1]) - 20);
          response = await makeRequest(effectiveMaxTokens);
        }
        if (!response.ok) {
          const finalErr = await response.text().catch(() => errText);
          handleErrorStatus(currentModel, response.status, finalErr || errText);
          recordModelOutcome(currentModel, {
            ok: false,
            latencyMs: Date.now() - tStart,
            status: response.status,
            error: (finalErr || errText).slice(0, 120),
          });
          throw new Error(`Model ${currentModel} stream returned ${response.status}: ${(finalErr || errText).slice(0, 200)}`);
        }
      }

      if (!response.body) {
        throw new Error(`Model ${currentModel} returned empty streaming body.`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let fullContent = "";
      let fullReasoning = "";
      let inThinkTag = false;
      let pendingTagBuf = "";

      const emitContent = (chunk) => {
        if (!chunk) return;
        emittedOutput = true;
        fullContent += chunk;
        if (onChunk) onChunk({ type: "token", content: chunk, model: currentModel });
      };
      const emitReasoning = (chunk) => {
        if (!chunk) return;
        fullReasoning += chunk;
        if (onChunk) onChunk({ type: "reasoning", text: chunk, model: currentModel });
      };

      // Incremental <think>...</think> parser so reasoning never leaks into final answer
      const processContentDelta = (text) => {
        pendingTagBuf += text;
        while (pendingTagBuf.length > 0) {
          if (!inThinkTag) {
            const openIdx = pendingTagBuf.indexOf("<think>");
            if (openIdx === -1) {
              // Keep last 6 chars in case "<think" is split across chunks
              const safeLen = Math.max(0, pendingTagBuf.length - 6);
              if (safeLen > 0) {
                emitContent(pendingTagBuf.slice(0, safeLen));
                pendingTagBuf = pendingTagBuf.slice(safeLen);
              }
              break;
            }
            if (openIdx > 0) emitContent(pendingTagBuf.slice(0, openIdx));
            pendingTagBuf = pendingTagBuf.slice(openIdx + 7);
            inThinkTag = true;
          } else {
            const closeIdx = pendingTagBuf.indexOf("</think>");
            if (closeIdx === -1) {
              const safeLen = Math.max(0, pendingTagBuf.length - 7);
              if (safeLen > 0) {
                emitReasoning(pendingTagBuf.slice(0, safeLen));
                pendingTagBuf = pendingTagBuf.slice(safeLen);
              }
              break;
            }
            if (closeIdx > 0) emitReasoning(pendingTagBuf.slice(0, closeIdx));
            pendingTagBuf = pendingTagBuf.slice(closeIdx + 8);
            inThinkTag = false;
          }
        }
      };

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

            const reasoning = delta.reasoning_content || delta.reasoning;
            if (reasoning) {
              emitReasoning(reasoning);
            }
            if (delta.content) {
              processContentDelta(delta.content);
            }
          } catch (_) { }
        }
      }

      // Flush remaining tag buffer
      if (pendingTagBuf) {
        if (inThinkTag) emitReasoning(pendingTagBuf);
        else emitContent(pendingTagBuf);
      }

      const trimmedAnswer = fullContent.trim();
      if (!trimmedAnswer) {
        quarantineModel(currentModel, "streamed empty content (reasoning exhausted tokens)", 429);
        recordModelOutcome(currentModel, { ok: false, latencyMs: Date.now() - tStart, status: 200, error: "empty content" });
        throw new Error(`Model ${currentModel} streamed empty content.`);
      }

      recordModelOutcome(currentModel, { ok: true, latencyMs: Date.now() - tStart, status: 200 });

      if (onChunk) {
        onChunk({
          type: "done",
          content: trimmedAnswer,
          reasoning: fullReasoning.trim(),
          model: currentModel,
          done: true,
        });
      }

      return {
        answer: trimmedAnswer,
        reasoning: fullReasoning.trim(),
        model: currentModel,
      };
    } catch (err) {
      if (signal?.aborted || emittedOutput) throw err;
      console.warn(`[OpenRouter Stream] ${currentModel} failed (${err.message}). Failing over...`);
      lastError = err;
    }
  }

  // 100% Offline / Zero-Cost Sovereign Fallback
  console.log("[OpenRouter Stream] Cloud models exhausted. Engaging Sovereign Local Cognitive Engine...");
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
 * Standard non-streaming chat completion with health-ranked failover & clean output.
 */
async function callOpenRouter({
  model,
  messages,
  max_tokens = 1400,
  temperature = 0.7,
  strictModel = false,
  returnMetadata = false,
  deepReasoning = false,
}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY. Add it to your .env file.");
  }

  if (accountTierState.checkedAt === 0) {
    await refreshAccountTier();
  }

  const modelsToTry = buildCandidateModels({ requestedModel: model, messages, strictModel });
  let lastError = null;

  for (const currentModel of modelsToTry) {
    if (isFreeQuotaExhausted() && isModelFree(currentModel)) {
      console.warn("[OpenRouter] Daily free quota exhausted (0 remaining). Skipping wasted retries -> local engine.");
      break;
    }
    let effectiveMaxTokens = max_tokens;
    const tStart = Date.now();
    try {
      const makeRequest = (tokensLimit) =>
        fetchWithTimeout(
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
              max_tokens: tokensLimit,
              temperature,
              ...(deepReasoning ? {} : { reasoning: { effort: "low" } }),
            }),
          },
          15000
        );

      let response = await fetchWithTransientRetry(() => makeRequest(effectiveMaxTokens));

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        const affordMatch = errText.match(/can only afford (\d+)/i);
        if (affordMatch && Number(affordMatch[1]) > 50) {
          effectiveMaxTokens = Math.max(50, Number(affordMatch[1]) - 20);
          response = await makeRequest(effectiveMaxTokens);
        }
        if (!response.ok) {
          const finalErr = await response.text().catch(() => errText);
          handleErrorStatus(currentModel, response.status, finalErr || errText);
          recordModelOutcome(currentModel, {
            ok: false,
            latencyMs: Date.now() - tStart,
            status: response.status,
            error: (finalErr || errText).slice(0, 120),
          });
          throw new Error(`Model ${currentModel} returned ${response.status}: ${(finalErr || errText).slice(0, 200)}`);
        }
      }

      const data = await response.json();
      const rawContent = data?.choices?.[0]?.message?.content;
      const rawReasoning = data?.choices?.[0]?.message?.reasoning_content || data?.choices?.[0]?.message?.reasoning || "";

      if (!rawContent) {
        quarantineModel(currentModel, "empty content (reasoning exhausted tokens)", 429);
        recordModelOutcome(currentModel, { ok: false, latencyMs: Date.now() - tStart, status: 200, error: "empty content" });
        throw new Error(`Model ${currentModel} returned empty content`);
      }

      const { clean, reasoning } = extractThinkBlocks(rawContent);
      const latencyMs = Date.now() - tStart;
      recordModelOutcome(currentModel, { ok: true, latencyMs, status: 200 });

      if (returnMetadata) {
        return {
          content: clean,
          reasoning: (rawReasoning + "\n" + reasoning).trim(),
          model: currentModel,
          latencyMs,
        };
      }
      return clean;
    } catch (err) {
      console.warn(`[OpenRouter] ${currentModel} failed (${err.message}). Failing over...`);
      lastError = err;
    }
  }

  // 100% Offline / Zero-Cost Sovereign Fallback
  console.log("[OpenRouter Non-Stream] Cloud models exhausted. Engaging Sovereign Local Cognitive Engine...");
  const { generateLocalFallback } = require("./localBrain");
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content || "";
  const localResult = await generateLocalFallback({ message: typeof lastUserMsg === "string" ? lastUserMsg : "Hello" });
  if (returnMetadata) {
    return {
      content: localResult.answer,
      reasoning: "",
      model: localResult.routing.modelLabel,
      latencyMs: 1,
    };
  }
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

  if (accountTierState.checkedAt === 0) {
    await refreshAccountTier();
  }

  const modelsToTry = buildCandidateModels({ requestedModel: model, messages, requireTools: true });
  let lastError = null;

  for (const currentModel of modelsToTry) {
    if (isFreeQuotaExhausted() && isModelFree(currentModel)) {
      console.warn("[OpenRouter ToolAgent] Daily free quota exhausted (0 remaining). Skipping wasted retries -> local engine.");
      break;
    }
    const tStart = Date.now();
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
            reasoning: { effort: "low" },
          }),
        },
        12000
      );

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        handleErrorStatus(currentModel, response.status, errText);
        if (response.status === 400) {
          quarantineModel(currentModel, errText.slice(0, 120), 400);
        }
        recordModelOutcome(currentModel, {
          ok: false,
          latencyMs: Date.now() - tStart,
          status: response.status,
          error: errText.slice(0, 120),
        });
        throw new Error(`Tool Model ${currentModel} returned ${response.status}: ${errText.slice(0, 200)}`);
      }

      const data = await response.json();
      const message = data?.choices?.[0]?.message;
      if (!message) {
        throw new Error(`Tool Model ${currentModel} returned empty message`);
      }

      // Clean any inline <think> tags from final plain-text replies
      if (message.content) {
        message.content = extractThinkBlocks(message.content).clean;
      }

      recordModelOutcome(currentModel, { ok: true, latencyMs: Date.now() - tStart, status: 200 });
      return message;
    } catch (err) {
      console.warn(`[OpenRouter ToolAgent] ${currentModel} failed (${err.message}). Failing over...`);
      lastError = err;
    }
  }

  throw new Error(`All candidate tool models failed. Last error: ${lastError?.message}`);
}

module.exports = {
  callOpenRouter,
  callOpenRouterWithTools,
  streamOpenRouterCompletion,
  refreshAccountTier,
  isFreeTierAccount,
  isModelQuarantined,
  getModelHealthReport,
  getModelScore,
  mapPaidToFreeSpecialist,
  FREE_FALLBACK_MODELS,
  FREE_FALLBACK_TOOL_MODELS,
  FREE_FALLBACK_VISION_MODELS,
  PAID_FALLBACK_MODELS,
};
