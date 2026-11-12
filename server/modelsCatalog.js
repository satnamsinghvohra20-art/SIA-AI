/**
 * SIA 460+ AI AGENT & MODEL DIRECTORY (2026 Live Catalog + Smart Scorer)
 * ----------------------------------------------------------------------
 * Verified registry of frontier, free-tier, reasoning, coding, multimodal,
 * and specialized AI models synchronized live with OpenRouter (/api/v1/models).
 */

const https = require("https");
const { isFreeTierAccount, isModelQuarantined, getModelScore } = require("./openrouterClient");

const PROVIDER_ICONS = {
  openai: "⚡",
  anthropic: "🧠",
  google: "✨",
  deepseek: "🔬",
  meta: "🌐",
  mistral: "🌪️",
  qwen: "🚀",
  xai: "💡",
  cohere: "🏢",
  perplexity: "🔍",
  nvidia: "💚",
  moonshot: "🌙",
  baidu: "🐻",
  liquid: "💧",
  openrouter: "🛰️",
  other: "🤖",
};

const EXCLUDED_MODELS = new Set([
  "thinkingmachines/inkling-2-small:free", // Harness-locked (403 via direct API)
]);

// Verified live 2026 curated directory on OpenRouter (zero dead IDs)
const CURATED_MODELS = [
  // --- VERIFIED WORKING FREE FRONTIER MODELS ($0 / Instant Access) ---
  {
    id: "nvidia/nemotron-3-ultra-550b-a55b:free",
    name: "NVIDIA Nemotron 3 Ultra 550B (Free Flagship Reasoning)",
    provider: "nvidia",
    category: "reasoning",
    context: "1M",
    featured: true,
    isFree: true,
    supportsTools: true,
    supportsVision: false,
    supportsReasoning: true,
    description: "550B MoE flagship with 1M context for deep reasoning, math, STEM, and system architecture ($0).",
  },
  {
    id: "cohere/north-mini-code:free",
    name: "Cohere North Mini Code (Free Coding & Tool Agent)",
    provider: "cohere",
    category: "coding",
    context: "256k",
    featured: true,
    isFree: true,
    supportsTools: true,
    supportsVision: false,
    supportsReasoning: true,
    description: "Specialized sparse MoE coding agent built for software engineering, debugging, and terminal tools ($0).",
  },
  {
    id: "nvidia/nemotron-3.5-super-vl:free",
    name: "NVIDIA Nemotron 3.5 Super VL (Free Multimodal Vision)",
    provider: "nvidia",
    category: "vision",
    context: "1M",
    featured: true,
    isFree: true,
    supportsTools: true,
    supportsVision: true,
    supportsReasoning: true,
    description: "1M context multimodal vision-language model for screenshots, diagrams, video, and UI grounding ($0).",
  },
  {
    id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    name: "NVIDIA Nemotron 3 Nano Omni 30B (Free Ultra-Fast)",
    provider: "nvidia",
    category: "fast",
    context: "256k",
    featured: true,
    isFree: true,
    supportsTools: true,
    supportsVision: true,
    supportsReasoning: true,
    description: "Sub-500ms omni-modal reasoning model supporting text, image, audio, video, and tool calling ($0).",
  },
  {
    id: "nvidia/nemotron-3.5-lightning:free",
    name: "NVIDIA Nemotron 3.5 Lightning (Free 1M Fast Agent)",
    provider: "nvidia",
    category: "fast",
    context: "1M",
    featured: true,
    isFree: true,
    supportsTools: true,
    supportsVision: false,
    supportsReasoning: true,
    description: "Ultra-fast 1M context hybrid reasoning and device-control tool agent ($0).",
  },
  {
    id: "baidu/ernie-5.5-flash-preview:free",
    name: "Baidu ERNIE 5.5 Flash (Free 1M Multilingual)",
    provider: "baidu",
    category: "multilingual",
    context: "1M",
    featured: true,
    isFree: true,
    supportsTools: true,
    supportsVision: false,
    supportsReasoning: true,
    description: "1M context multilingual & structured output flash model ($0).",
  },
  {
    id: "dots-studio/dots-3-note-preview:free",
    name: "Dots 3 Note (Free 512k Creative & Vision)",
    provider: "other",
    category: "creative",
    context: "512k",
    featured: true,
    isFree: true,
    supportsTools: true,
    supportsVision: true,
    supportsReasoning: true,
    description: "512k context creative writing, note synthesis, and multimodal reasoning ($0).",
  },
  {
    id: "liquid/lfm-2.5-2.6b:free",
    name: "Liquid LFM 2.5 2.6B (Free Edge Speed)",
    provider: "liquid",
    category: "fast",
    context: "64k",
    isFree: true,
    supportsTools: true,
    supportsVision: false,
    supportsReasoning: true,
    description: "Ultra-lightweight Liquid Foundation Model for rapid structured outputs ($0).",
  },
  {
    id: "liquid/lfm-3-1.7b:free",
    name: "Liquid LFM 3 1.7B (Free 262k Nano)",
    provider: "liquid",
    category: "fast",
    context: "262k",
    isFree: true,
    supportsTools: true,
    supportsVision: false,
    supportsReasoning: true,
  },
  {
    id: "recursive/flint-v1.0:free",
    name: "Recursive Flint v1.0 (Free 262k)",
    provider: "other",
    category: "open_source",
    context: "262k",
    isFree: true,
    supportsTools: true,
    supportsVision: false,
    supportsReasoning: true,
  },
  {
    id: "google/gemma-4-31b-it:free",
    name: "Google Gemma 4 31B Instruct (Free)",
    provider: "google",
    category: "open_source",
    context: "262k",
    isFree: true,
    supportsTools: true,
    supportsVision: true,
    supportsReasoning: true,
  },
  {
    id: "google/gemma-4-26b-a4b-it:free",
    name: "Google Gemma 4 26B A4B MoE (Free)",
    provider: "google",
    category: "fast",
    context: "262k",
    isFree: true,
    supportsTools: true,
    supportsVision: true,
    supportsReasoning: true,
  },
  {
    id: "openrouter/free",
    name: "OpenRouter Free Smart Router",
    provider: "openrouter",
    category: "general",
    context: "200k",
    featured: true,
    isFree: true,
    supportsTools: true,
    supportsVision: true,
    supportsReasoning: true,
  },

  // --- ANTHROPIC CLAUDE (2026 Frontier Coding, Creative & Reasoning) ---
  { id: "anthropic/claude-fable-5.2", name: "Claude Fable 5.2 (Frontier Architecture & Prose)", provider: "anthropic", category: "creative", context: "1M", featured: true, isFree: false, supportsTools: true, supportsVision: true, supportsReasoning: true },
  { id: "anthropic/claude-opus-5.5", name: "Claude Opus 5.5 (Deep Complex Systems)", provider: "anthropic", category: "reasoning", context: "1M", featured: true, isFree: false, supportsTools: true, supportsVision: true, supportsReasoning: true },
  { id: "anthropic/claude-sonnet-5.5", name: "Claude Sonnet 5.5 (Flagship Coding & Agents)", provider: "anthropic", category: "coding", context: "1M", featured: true, isFree: false, supportsTools: true, supportsVision: true, supportsReasoning: true },
  { id: "anthropic/claude-haiku-5.5", name: "Claude Haiku 5.5 (Ultra-Fast Intelligence)", provider: "anthropic", category: "fast", context: "1M", featured: true, isFree: false, supportsTools: true, supportsVision: true, supportsReasoning: true },
  { id: "anthropic/claude-sonnet-5", name: "Claude Sonnet 5", provider: "anthropic", category: "coding", context: "1M", isFree: false, supportsTools: true, supportsVision: true, supportsReasoning: true },
  { id: "anthropic/claude-haiku-4.5", name: "Claude Haiku 4.5", provider: "anthropic", category: "fast", context: "200k", isFree: false, supportsTools: true, supportsVision: true, supportsReasoning: true },

  // --- OPENAI (GPT-6 & GPT-5 Generations) ---
  { id: "openai/gpt-6.1-terra", name: "OpenAI GPT-6.1 Terra (Omni Flagship)", provider: "openai", category: "general", context: "1M", featured: true, isFree: false, supportsTools: true, supportsVision: true, supportsReasoning: true },
  { id: "openai/gpt-6.1-sol-pro", name: "OpenAI GPT-6.1 Sol Pro (Deep STEM)", provider: "openai", category: "reasoning", context: "1M", featured: true, isFree: false, supportsTools: true, supportsVision: true, supportsReasoning: true },
  { id: "openai/gpt-6.1-sol", name: "OpenAI GPT-6.1 Sol (Reasoning)", provider: "openai", category: "reasoning", context: "1M", isFree: false, supportsTools: true, supportsVision: true, supportsReasoning: true },
  { id: "openai/gpt-6-luna", name: "OpenAI GPT-6 Luna (Ultra-Fast General & Tools)", provider: "openai", category: "fast", context: "1M", featured: true, isFree: false, supportsTools: true, supportsVision: true, supportsReasoning: true },
  { id: "openai/gpt-5.6-luna", name: "OpenAI GPT-5.6 Luna", provider: "openai", category: "fast", context: "1M", isFree: false, supportsTools: true, supportsVision: true, supportsReasoning: true },
  { id: "openai/gpt-5.5", name: "OpenAI GPT-5.5", provider: "openai", category: "vision", context: "128k", isFree: false, supportsTools: true, supportsVision: true, supportsReasoning: true },
  { id: "openai/gpt-5.4-mini", name: "OpenAI GPT-5.4 Mini", provider: "openai", category: "fast", context: "128k", isFree: false, supportsTools: true, supportsVision: true, supportsReasoning: true },
  { id: "openai/gpt-4o-mini", name: "OpenAI GPT-4o Mini", provider: "openai", category: "fast", context: "128k", isFree: false, supportsTools: true, supportsVision: true, supportsReasoning: false },

  // --- GOOGLE GEMINI (Multimodal & 1M+ Context) ---
  { id: "google/gemini-4-carbon", name: "Google Gemini 4 Carbon (Flagship 1M Multimodal)", provider: "google", category: "vision", context: "1M", featured: true, isFree: false, supportsTools: true, supportsVision: true, supportsReasoning: true },
  { id: "google/gemini-4-argon", name: "Google Gemini 4 Argon (Deep Agentic Coding)", provider: "google", category: "coding", context: "1M", featured: true, isFree: false, supportsTools: true, supportsVision: true, supportsReasoning: true },
  { id: "google/gemini-3.8-flash", name: "Google Gemini 3.8 Flash (High-Speed Multimodal)", provider: "google", category: "fast", context: "1M", featured: true, isFree: false, supportsTools: true, supportsVision: true, supportsReasoning: true },
  { id: "google/gemini-3.5-flash-lite", name: "Google Gemini 3.5 Flash Lite", provider: "google", category: "fast", context: "1M", isFree: false, supportsTools: true, supportsVision: true, supportsReasoning: true },
  { id: "google/gemini-2.5-pro", name: "Google Gemini 2.5 Pro", provider: "google", category: "vision", context: "2M", isFree: false, supportsTools: true, supportsVision: true, supportsReasoning: true },
  { id: "google/gemini-2.5-flash", name: "Google Gemini 2.5 Flash", provider: "google", category: "fast", context: "1M", isFree: false, supportsTools: true, supportsVision: true, supportsReasoning: true },

  // --- DEEPSEEK (V4 MoE High-Throughput Reasoning & Code) ---
  { id: "deepseek/deepseek-v4.1-flash", name: "DeepSeek V4.1 Flash (Ultra-Value Coding & Vision)", provider: "deepseek", category: "coding", context: "1M", featured: true, isFree: false, supportsTools: true, supportsVision: true, supportsReasoning: true },
  { id: "deepseek/deepseek-v4-pro", name: "DeepSeek V4 Pro (Deep STEM & Math)", provider: "deepseek", category: "reasoning", context: "1M", featured: true, isFree: false, supportsTools: true, supportsVision: false, supportsReasoning: true },
  { id: "deepseek/deepseek-r1-0528", name: "DeepSeek R1 (0528 Open Reasoning)", provider: "deepseek", category: "reasoning", context: "164k", isFree: false, supportsTools: true, supportsVision: false, supportsReasoning: true },
  { id: "deepseek/deepseek-v3.2", name: "DeepSeek V3.2", provider: "deepseek", category: "general", context: "164k", isFree: false, supportsTools: true, supportsVision: false, supportsReasoning: true },
  { id: "deepseek/deepseek-chat", name: "DeepSeek V3 Chat", provider: "deepseek", category: "general", context: "164k", isFree: false, supportsTools: true, supportsVision: false, supportsReasoning: false },

  // --- QWEN (Qwen 3.8 Multimodal, Multilingual & Coder) ---
  { id: "qwen/qwen3.8-max-prime", name: "Qwen 3.8 Max Prime", provider: "qwen", category: "reasoning", context: "1M", featured: true, isFree: false, supportsTools: true, supportsVision: true, supportsReasoning: true },
  { id: "qwen/qwen3.8-max-0902", name: "Qwen 3.8 Max (Multilingual 100+)", provider: "qwen", category: "multilingual", context: "1M", isFree: false, supportsTools: true, supportsVision: true, supportsReasoning: true },
  { id: "qwen/qwen3.8-flash", name: "Qwen 3.8 Flash", provider: "qwen", category: "fast", context: "1M", isFree: false, supportsTools: true, supportsVision: true, supportsReasoning: true },
  { id: "qwen/qwen3.7-flash", name: "Qwen 3.7 Flash (Ultra-Cheap Speed)", provider: "qwen", category: "fast", context: "1M", isFree: false, supportsTools: true, supportsVision: true, supportsReasoning: true },
  { id: "qwen/qwen3-coder-next", name: "Qwen3 Coder Next", provider: "qwen", category: "coding", context: "262k", featured: true, isFree: false, supportsTools: true, supportsVision: false, supportsReasoning: false },
  { id: "qwen/qwen-2.5-coder-32b-instruct", name: "Qwen 2.5 Coder 32B", provider: "qwen", category: "coding", context: "32k", isFree: false, supportsTools: true, supportsVision: false, supportsReasoning: false },
  { id: "qwen/qwen-2.5-72b-instruct", name: "Qwen 2.5 72B Instruct", provider: "qwen", category: "multilingual", context: "32k", isFree: false, supportsTools: true, supportsVision: false, supportsReasoning: false },

  // --- META LLAMA 4 & 3.3 ---
  { id: "meta-llama/llama-4-maverick", name: "Meta Llama 4 Maverick (Open Multimodal)", provider: "meta", category: "open_source", context: "524k", featured: true, isFree: false, supportsTools: true, supportsVision: true, supportsReasoning: false },
  { id: "meta-llama/llama-4-scout", name: "Meta Llama 4 Scout (1.3M Context)", provider: "meta", category: "open_source", context: "1.3M", isFree: false, supportsTools: true, supportsVision: true, supportsReasoning: false },
  { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B Instruct", provider: "meta", category: "open_source", context: "131k", isFree: false, supportsTools: true, supportsVision: false, supportsReasoning: false },

  // --- XAI GROK ---
  { id: "x-ai/grok-4.7", name: "xAI Grok 4.7 (Witty & Frontier)", provider: "xai", category: "witty", context: "500k", featured: true, isFree: false, supportsTools: true, supportsVision: true, supportsReasoning: true },
  { id: "x-ai/grok-4.20", name: "xAI Grok 4.20 (2M Context)", provider: "xai", category: "witty", context: "2M", isFree: false, supportsTools: true, supportsVision: true, supportsReasoning: true },

  // --- MISTRAL AI ---
  { id: "mistralai/mistral-large-4-0", name: "Mistral Large 4.0 (Enterprise Security)", provider: "mistral", category: "enterprise", context: "1M", featured: true, isFree: false, supportsTools: true, supportsVision: true, supportsReasoning: true },
  { id: "mistralai/devstral-2512", name: "Mistral Devstral 2512 (Coding Agent)", provider: "mistral", category: "coding", context: "262k", isFree: false, supportsTools: true, supportsVision: false, supportsReasoning: false },
  { id: "mistralai/codestral-2508", name: "Codestral 2508", provider: "mistral", category: "coding", context: "256k", isFree: false, supportsTools: true, supportsVision: false, supportsReasoning: false },

  // --- PERPLEXITY (Live Web Search & Citations) ---
  { id: "perplexity/sonar-pro-search", name: "Perplexity Sonar Pro Search (Live Web)", provider: "perplexity", category: "research", context: "200k", featured: true, isFree: false, supportsTools: false, supportsVision: true, supportsReasoning: true },
  { id: "perplexity/sonar-reasoning-pro", name: "Perplexity Sonar Reasoning Pro", provider: "perplexity", category: "research", context: "128k", isFree: false, supportsTools: false, supportsVision: true, supportsReasoning: true },
  { id: "perplexity/sonar-deep-research", name: "Perplexity Sonar Deep Research", provider: "perplexity", category: "research", context: "128k", isFree: false, supportsTools: false, supportsVision: false, supportsReasoning: true },
  { id: "perplexity/sonar", name: "Perplexity Sonar (Fast Search)", provider: "perplexity", category: "research", context: "127k", isFree: false, supportsTools: false, supportsVision: true, supportsReasoning: false },

  // --- MOONSHOT KIMI & COHERE ---
  { id: "moonshotai/kimi-k3.1-pro", name: "Kimi K3.1 Pro (1M Video & Code)", provider: "moonshot", category: "coding", context: "1M", featured: true, isFree: false, supportsTools: true, supportsVision: true, supportsReasoning: true },
  { id: "cohere/command-a-plus", name: "Cohere Command A+ (Enterprise RAG)", provider: "cohere", category: "enterprise", context: "192k", isFree: false, supportsTools: true, supportsVision: true, supportsReasoning: true },

  // --- OPENROUTER SMART ROUTERS ---
  { id: "openrouter/auto", name: "OpenRouter Auto Smart Router", provider: "openrouter", category: "general", context: "2M", featured: true, isFree: false, supportsTools: true, supportsVision: true, supportsReasoning: true },
  { id: "openrouter/auto-code", name: "OpenRouter Auto-Code Harness Router", provider: "openrouter", category: "coding", context: "2M", isFree: false, supportsTools: true, supportsVision: true, supportsReasoning: true },
];

let dynamicModelsCache = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function inferCategory(id, name) {
  const s = `${id} ${name}`.toLowerCase();
  if (s.includes("r1") || s.includes("sol") || s.includes("o3") || s.includes("ultra") || s.includes("math") || s.includes("reasoning") || s.includes("thinking")) return "reasoning";
  if (s.includes("coder") || s.includes("code") || s.includes("devstral") || s.includes("python")) return "coding";
  if (s.includes("vl") || s.includes("vision") || s.includes("image") || s.includes("omni")) return "vision";
  if (s.includes("sonar") || s.includes("search") || s.includes("perplexity")) return "research";
  if (s.includes("flash") || s.includes("haiku") || s.includes("mini") || s.includes("luna") || s.includes("lightning") || s.includes("nano") || s.includes("lite")) return "fast";
  if (s.includes("fable") || s.includes("story") || s.includes("creative") || s.includes("note")) return "creative";
  if (s.includes("command") || s.includes("enterprise") || s.includes("large")) return "enterprise";
  if (s.includes("llama") || s.includes("qwen") || s.includes("mistral") || s.includes("deepseek") || s.includes("gemma")) return "open_source";
  return "general";
}

function inferProvider(id) {
  const prefix = (id.split("/")[0] || "").toLowerCase();
  if (prefix.includes("openai")) return "openai";
  if (prefix.includes("anthropic")) return "anthropic";
  if (prefix.includes("google")) return "google";
  if (prefix.includes("deepseek")) return "deepseek";
  if (prefix.includes("meta") || prefix.includes("llama")) return "meta";
  if (prefix.includes("mistral")) return "mistral";
  if (prefix.includes("qwen")) return "qwen";
  if (prefix.includes("x-ai") || prefix.includes("xai")) return "xai";
  if (prefix.includes("nvidia")) return "nvidia";
  if (prefix.includes("cohere")) return "cohere";
  if (prefix.includes("perplexity")) return "perplexity";
  if (prefix.includes("moonshot")) return "moonshot";
  if (prefix.includes("baidu")) return "baidu";
  if (prefix.includes("liquid")) return "liquid";
  if (prefix.includes("openrouter")) return "openrouter";
  return "other";
}

function formatContextLength(len) {
  if (!len || typeof len !== "number") return "128k";
  if (len >= 1000000) return `${(len / 1000000).toFixed(len % 1000000 === 0 ? 0 : 1)}M`;
  return `${Math.round(len / 1000)}k`;
}

async function fetchOpenRouterModels() {
  return new Promise((resolve) => {
    const req = https.get("https://openrouter.ai/api/v1/models", { timeout: 8000 }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed?.data) && parsed.data.length > 0) {
            resolve(parsed.data);
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
  });
}

async function getAllModels() {
  const now = Date.now();
  if (dynamicModelsCache && now - lastFetchTime < CACHE_TTL_MS) {
    return dynamicModelsCache;
  }

  const modelMap = new Map();
  for (const m of CURATED_MODELS) {
    modelMap.set(m.id, {
      ...m,
      icon: PROVIDER_ICONS[m.provider] || "🤖",
    });
  }

  const liveList = await fetchOpenRouterModels();
  if (liveList && Array.isArray(liveList)) {
    for (const item of liveList) {
      if (!item?.id || EXCLUDED_MODELS.has(item.id)) continue;
      const existing = modelMap.get(item.id);
      const provider = existing?.provider || inferProvider(item.id);
      const category = existing?.category || inferCategory(item.id, item.name || "");
      const ctx = item.context_length ? formatContextLength(item.context_length) : (existing?.context || "128k");
      const params = Array.isArray(item.supported_parameters) ? item.supported_parameters : [];
      const modality = String(item.architecture?.modality || "text->text").toLowerCase();
      const isFree =
        existing?.isFree ??
        (item.id.endsWith(":free") || (Number(item.pricing?.prompt) === 0 && Number(item.pricing?.completion) === 0));

      modelMap.set(item.id, {
        id: item.id,
        name: existing?.name || item.name || item.id,
        provider,
        category,
        context: ctx,
        description: existing?.description || item.description || "",
        featured: Boolean(existing?.featured),
        isFree,
        supportsTools: existing?.supportsTools ?? params.includes("tools"),
        supportsVision: existing?.supportsVision ?? modality.includes("image"),
        supportsReasoning: existing?.supportsReasoning ?? (params.includes("reasoning") || params.includes("include_reasoning")),
        icon: PROVIDER_ICONS[provider] || "🤖",
      });
    }
  }

  // Sort so free working models & featured models appear cleanly at the top
  dynamicModelsCache = Array.from(modelMap.values()).sort((a, b) => {
    if (a.isFree !== b.isFree && isFreeTierAccount()) return a.isFree ? -1 : 1;
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return 0;
  });
  lastFetchTime = now;
  return dynamicModelsCache;
}

/**
 * Intelligent 460+ Model Evaluation & Match Engine
 * Automatically picks the #1 fastest, healthiest, capability-matched model
 * for the user's query and account tier (free vs paid).
 */
function matchBestModelFrom300(query, options = {}) {
  const q = String(query || "").toLowerCase().trim();
  const freeTierOnly = options.freeTierOnly ?? isFreeTierAccount();
  const requireVision = Boolean(options.requireVision);
  const requireTools = Boolean(options.requireTools);

  const rawModels = dynamicModelsCache || CURATED_MODELS;

  // Filter strictly by working capabilities & account tier
  let candidates = rawModels.filter((m) => {
    if (EXCLUDED_MODELS.has(m.id)) return false;
    if (m.id.endsWith(":batch")) return false; // Batch endpoints are async, not interactive chat
    if (isModelQuarantined(m.id)) return false;
    if (freeTierOnly && !(m.isFree || m.id.endsWith(":free") || m.id === "openrouter/free")) return false;
    if (requireVision && m.supportsVision === false) return false;
    if (requireTools && m.supportsTools === false) return false;
    return true;
  });

  if (candidates.length === 0) {
    candidates = CURATED_MODELS.filter((m) => !freeTierOnly || m.isFree);
  }

  // Intent Signals
  const hasCode = /\b(function|def|const|class|import|return|git|sql|async|await|bug|debug|refactor|compile|regex|algorithm|typescript|javascript|python|rust|c\+\+|java|html|css|php|ruby|swift|golang|api|endpoint|database|script|fastapi|react|node)\b/i.test(q);
  const hasMathSTEM = /\b(prove|theorem|calculus|integral|derivative|matrix|eigen|differential|probability|combinatorics|discrete math|physics|chemistry|equation|math|calculate|solve)\b/i.test(q);
  const hasDeepReasoning = /\b(step by step|chain of thought|first principles|deduction|deep analysis|architecture|design system|tradeoffs|compare|strategy|why does|explain in depth)\b/i.test(q);
  const hasVision = requireVision || /\b(image|picture|screenshot|photo|diagram|chart|graph|look at this|ocr|read screen|inspect screen)\b/i.test(q);
  const hasLiveSearch = /\b(news|latest|today|current price|stock price|live weather|who won|score|recent events|citation|source)\b/i.test(q);
  const hasCreative = /\b(story|poem|novel|character|roleplay|dialogue|creative writing|essay|song lyrics|script|narrative|slogan|tagline|write a)\b/i.test(q);
  const hasStructuredData = /\b(json|csv|yaml|xml|extract table|parse rows|schema|sql query)\b/i.test(q);
  const isShortGreeting = q.length < 40 && /^(hi|hello|hey|good morning|good evening|who are you|what can you do|how are you|thanks|thank you|ping|ok|yo)\b/i.test(q);
  const isNonEnglish = /[^\x00-\x7F]/.test(query || "") && (query || "").length > 4;

  const scored = candidates.map((m) => {
    let score = 50;
    const id = (m.id || "").toLowerCase();
    const cat = (m.category || "").toLowerCase();

    if (hasCode) {
      if (cat === "coding") score += 45;
      if (id.includes("north-mini-code")) score += 55;
      if (id.includes("claude-sonnet-5.5")) score += 50;
      if (id.includes("qwen3-coder")) score += 45;
      if (id.includes("deepseek-v4.1-flash")) score += 40;
      if (id.includes("devstral")) score += 38;
      if (id.includes("nemotron-3-ultra")) score += 30;
    }

    if (hasMathSTEM || hasDeepReasoning) {
      if (cat === "reasoning") score += 45;
      if (id.includes("nemotron-3-ultra-550b")) score += 55;
      if (id.includes("gpt-6.1-sol")) score += 52;
      if (id.includes("claude-opus-5.5")) score += 50;
      if (id.includes("deepseek-v4-pro") || id.includes("deepseek-r1")) score += 45;
      if (id.includes("nemotron-3.5-lightning")) score += 35;
    }

    if (hasVision) {
      if (m.supportsVision) score += 40;
      if (cat === "vision") score += 35;
      if (id.includes("nemotron-3.5-super-vl")) score += 55;
      if (id.includes("gemini-3.8-flash") || id.includes("gemini-4-carbon")) score += 50;
      if (id.includes("nemotron-3-nano-omni")) score += 40;
    }

    if (hasLiveSearch) {
      if (cat === "research") score += 50;
      if (id.includes("sonar-pro-search")) score += 55;
      if (id.includes("sonar")) score += 45;
      if (id.includes("nemotron-3.5-lightning")) score += 30;
    }

    if (hasCreative) {
      if (cat === "creative") score += 45;
      if (id.includes("claude-fable-5.2")) score += 55;
      if (id.includes("dots-3-note")) score += 50;
      if (id.includes("grok-4.7")) score += 40;
    }

    if (hasStructuredData) {
      if (id.includes("gpt-6-luna") || id.includes("nemotron-3.5-lightning") || id.includes("ernie-5.5")) score += 40;
    }

    if (isNonEnglish) {
      if (cat === "multilingual" || id.includes("ernie-5.5") || id.includes("qwen3.8")) score += 50;
    }

    if (isShortGreeting) {
      if (cat === "fast") score += 45;
      if (id.includes("north-mini-code")) score += 55;
      if (id.includes("ernie-5.5") || id.includes("lfm-2.5")) score += 45;
      if (id.includes("gpt-6-luna") || id.includes("claude-haiku-5.5")) score += 50;
    }

    // Default generalist bonus when no specific signal triggered
    if (!hasCode && !hasMathSTEM && !hasDeepReasoning && !hasVision && !hasLiveSearch && !hasCreative && !isShortGreeting) {
      if (id.includes("north-mini-code")) score += 45;
      if (id.includes("nemotron-3-ultra-550b")) score += 42;
      if (id.includes("ernie-5.5")) score += 35;
      if (id.includes("gpt-6-luna") || id.includes("gemini-3.8-flash")) score += 40;
    }

    if (m.featured) score += 15;

    // Blend in live observed speed/reliability telemetry from openrouterClient
    const liveHealthBonus = Math.min(25, Math.max(-40, getModelScore(m.id) * 0.2));
    score += liveHealthBonus;

    return { ...m, score: Math.round(score) };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0] || candidates[0];

  return {
    model: best.id,
    modelLabel: best.name,
    category: best.category || "general",
    score: best.score,
    provider: best.provider,
    icon: best.icon || PROVIDER_ICONS[best.provider] || "🤖",
    why: `Auto-selected #1 working ${freeTierOnly ? "free-frontier " : ""}model (${best.name}) for optimal ${best.category} speed & accuracy.`,
    topMatches: scored.slice(0, 5).map((s) => ({ id: s.id, name: s.name, score: s.score })),
  };
}

function getModelByIdSync(id) {
  if (dynamicModelsCache) {
    const found = dynamicModelsCache.find((m) => m.id === id);
    if (found) return found;
  }
  return CURATED_MODELS.find((m) => m.id === id) || null;
}

module.exports = {
  getAllModels,
  getModelByIdSync,
  matchBestModelFrom300,
  CURATED_MODELS,
  PROVIDER_ICONS,
};
