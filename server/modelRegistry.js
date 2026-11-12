/**
 * MODEL REGISTRY (27 Specialized AI Protocols — 2026 Frontier + Verified Free Mirrors)
 * ------------------------------------------------------------------------------------
 * Maps every task category to:
 *   - `model`:     Best-in-class 2026 frontier paid model on OpenRouter
 *   - `freeModel`: Verified live (HTTP 200 OK) $0 free-tier specialist model on OpenRouter
 *
 * When the active OpenRouter key is free-tier (no purchased credits), Sia automatically
 * routes to `freeModel` in <1ms without wasting seconds failing through 402 paid models.
 *
 * Browse live catalog: https://openrouter.ai/models
 */

const MODEL_REGISTRY = {
  // 1. Heavy coding, system architecture, refactoring & bug fixing
  coding: {
    model: "anthropic/claude-sonnet-5.5",
    freeModel: "cohere/north-mini-code:free",
    label: "Claude Sonnet 5.5 / North Mini Code (Coding Flagship)",
    why: "Industry-leading software architecture, multi-file refactoring, and agentic coding",
  },

  // 2. High-speed, high-accuracy code generation & scripting
  coding_fast: {
    model: "deepseek/deepseek-v4.1-flash",
    freeModel: "cohere/north-mini-code:free",
    label: "DeepSeek V4.1 Flash / North Mini Code (Fast Code)",
    why: "Ultra-low latency, specialized for fast syntax, algorithms, and script generation",
  },

  // 3. Python, backend, APIs, databases & logic architecture
  coding_python: {
    model: "qwen/qwen3-coder-next",
    freeModel: "cohere/north-mini-code:free",
    label: "Qwen3 Coder Next / North Mini Code (Python & Backend)",
    why: "Deep code specialist optimized for Python, APIs, terminal commands, and backend logic",
  },

  // 4. Advanced mathematical reasoning, STEM proofs, hard logic
  reasoning: {
    model: "openai/gpt-6.1-sol",
    freeModel: "nvidia/nemotron-3-ultra-550b-a55b:free",
    label: "GPT-6.1 Sol / Nemotron 3 Ultra 550B (STEM & Math)",
    why: "Deep multi-step reasoning, mathematical proofs, and hard STEM logic",
  },

  // 5. Open deep chain-of-thought step-by-step reasoning
  deep_thinking: {
    model: "anthropic/claude-opus-5.5",
    freeModel: "nvidia/nemotron-3-ultra-550b-a55b:free",
    label: "Claude Opus 5.5 / Nemotron 3 Ultra 550B (Deep Thinking)",
    why: "Maximum depth chain-of-thought reasoning with 550B-1M context synthesis",
  },

  // 6. Fast mathematical & logic reasoning
  fast_reasoning: {
    model: "deepseek/deepseek-v4.1-flash",
    freeModel: "nvidia/nemotron-3.5-lightning:free",
    label: "DeepSeek V4.1 Flash / Nemotron 3.5 Lightning (Fast Logic)",
    why: "High-speed hybrid MoE reasoning with 1M token context",
  },

  // 7. Long-form creative writing, storytelling, essays, marketing copy
  creative: {
    model: "anthropic/claude-fable-5.2",
    freeModel: "dots-studio/dots-3-note-preview:free",
    label: "Claude Fable 5.2 / Dots 3 Note (Creative & Prose)",
    why: "Masterful nuanced prose, narrative storytelling, and expressive writing",
  },

  // 8. High-speed brainstorming, slogans, creative copy & drafting
  creative_fast: {
    model: "anthropic/claude-haiku-5.5",
    freeModel: "dots-studio/dots-3-note-preview:free",
    label: "Claude Haiku 5.5 / Dots 3 Note (Fast Creative)",
    why: "Ultra-fast creative drafting, brainstorming, and punchy copywriting",
  },

  // 9. Live web research with verified source citations & deep reasoning
  research: {
    model: "perplexity/sonar-pro-search",
    freeModel: "nvidia/nemotron-3-ultra-550b-a55b:free",
    label: "Perplexity Sonar Pro Search / Nemotron 3 Ultra (Deep Research)",
    why: "Comprehensive factual synthesis, verified analysis, and deep exploration",
  },

  // 10. Instant real-time web search, current news & quick fact lookups
  research_fast: {
    model: "perplexity/sonar",
    freeModel: "nvidia/nemotron-3.5-lightning:free",
    label: "Perplexity Sonar / Nemotron 3.5 Lightning (Fast Research)",
    why: "Sub-second research synthesis and rapid factual lookup",
  },

  // 11. Multimodal visual understanding (charts, diagrams, UI, complex images)
  vision: {
    model: "google/gemini-3.8-flash",
    freeModel: "nvidia/nemotron-3.5-super-vl:free",
    label: "Gemini 3.8 Flash / Nemotron 3.5 Super VL (Deep Vision)",
    why: "Flagship multimodal model for complex image, video, chart, and UI analysis",
  },

  // 12. Real-time visual OCR, screenshots & instant photo inspection
  vision_fast: {
    model: "google/gemini-3.5-flash-lite",
    freeModel: "nvidia/nemotron-3.5-super-vl:free",
    label: "Gemini 3.5 Flash Lite / Nemotron 3.5 Super VL (Fast Vision/OCR)",
    why: "Instant image recognition, screenshot grounding, and document OCR",
  },

  // 13. Massive 1M-2M token context window (entire codebases, books, huge PDFs)
  long_context: {
    model: "google/gemini-4-carbon",
    freeModel: "nvidia/nemotron-3.5-lightning:free",
    label: "Gemini 4 Carbon / Nemotron 3.5 Lightning (1M+ Context)",
    why: "1,000,000+ token context window for massive document & codebase ingestion",
  },

  // 14. High-speed general everyday knowledge & conversation
  fast_general: {
    model: "openai/gpt-6-luna",
    freeModel: "cohere/north-mini-code:free",
    label: "GPT-6 Luna / North Mini Code (Fast General)",
    why: "Low latency, high reliability, and broad general intelligence",
  },

  // 15. Lowest latency instant conversational chat
  ultra_fast_chat: {
    model: "openai/gpt-6-luna",
    freeModel: "cohere/north-mini-code:free",
    label: "GPT-6 Luna / North Mini Code (Ultra-Fast)",
    why: "Fastest verified response speed for quick answers and rapid dialogue",
  },

  // 16. Flagship multimodal omni intelligence
  flagship_omni: {
    model: "openai/gpt-6.1-terra",
    freeModel: "nvidia/nemotron-3-ultra-550b-a55b:free",
    label: "GPT-6.1 Terra / Nemotron 3 Ultra 550B (Flagship Omni)",
    why: "High-capability multimodal reasoning and frontier generalist intelligence",
  },

  // 17. Fast and efficient everyday drafting & summaries
  gpt_fast: {
    model: "openai/gpt-5.6-luna",
    freeModel: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    label: "GPT-5.6 Luna / Nemotron 3 Nano Omni (Fast Drafting)",
    why: "Lightweight, highly capable model for rapid daily tasks and summaries",
  },

  // 18. Structured JSON, tabular data, CSV parsing & schema validation
  data: {
    model: "openai/gpt-6-luna",
    freeModel: "nvidia/nemotron-3.5-lightning:free",
    label: "GPT-6 Luna / Nemotron 3.5 Lightning (Structured Data & JSON)",
    why: "Flawless structured JSON extraction and deterministic schema mapping",
  },

  // 19. Device-control agent loop (tool calling for Edge, Windows & Mobile)
  device_control: {
    model: "openai/gpt-6-luna",
    freeModel: "cohere/north-mini-code:free",
    label: "GPT-6 Luna / North Mini Code (Device & Tool Agent)",
    why: "High-precision function/tool calling for multi-step Windows & Mobile control",
  },

  // 20. Open-weights flagship foundation model
  open_source: {
    model: "meta-llama/llama-4-maverick",
    freeModel: "nvidia/nemotron-3.5-lightning:free",
    label: "Llama 4 Maverick / Nemotron 3.5 Lightning (Open Source)",
    why: "World-class open-weights foundation model with high throughput",
  },

  // 21. Massive open-weights giant MoE
  open_source_giant: {
    model: "qwen/qwen3.8-2.4t-a95b",
    freeModel: "nvidia/nemotron-3-ultra-550b-a55b:free",
    label: "Qwen3.8 2.4T / Nemotron 3 Ultra 550B (Open Giant MoE)",
    why: "Massive mixture-of-experts open architecture for deep reasoning",
  },

  // 22. Multilingual translation, cross-language reasoning & global dialect
  multilingual: {
    model: "qwen/qwen3.8-max-0902",
    freeModel: "baidu/ernie-5.5-flash-preview:free",
    label: "Qwen3.8 Max / ERNIE 5.5 Flash (Multilingual & Global)",
    why: "Superior multilingual fluency across 100+ languages and translation",
  },

  // 23. Cybersecurity, code vulnerability auditing & enterprise logic
  cybersecurity: {
    model: "mistralai/mistral-large-4-0",
    freeModel: "nvidia/nemotron-3-ultra-550b-a55b:free",
    label: "Mistral Large 4.0 / Nemotron 3 Ultra (Security & Audit)",
    why: "Specialized in security auditing, vulnerability analysis, and rigorous critique",
  },

  // 24. Truth-seeking, witty real-time intelligence
  witty_unfiltered: {
    model: "x-ai/grok-4.7",
    freeModel: "dots-studio/dots-3-note-preview:free",
    label: "xAI Grok 4.7 / Dots 3 Note (Witty & Direct)",
    why: "Sharp wit, direct answers, and dynamic conversational agility",
  },

  // 25. High-speed scientific calculations & analytical intelligence
  math_science: {
    model: "deepseek/deepseek-v4-pro",
    freeModel: "nvidia/nemotron-3-ultra-550b-a55b:free",
    label: "DeepSeek V4 Pro / Nemotron 3 Ultra (Science & Math)",
    why: "Top-tier MoE model for physics, chemistry, and analytical calculations",
  },

  // 26. Enterprise strategy, financial reports, contract analysis
  finance_business: {
    model: "cohere/command-a-plus",
    freeModel: "nvidia/nemotron-3-ultra-550b-a55b:free",
    label: "Cohere Command A+ / Nemotron 3 Ultra (Business & Finance)",
    why: "Optimized for enterprise documents, financial models, and strategic analysis",
  },

  // 27. Multi-Model Super-Blend (Combines top models & synthesizes best answer)
  super_blend: {
    model: "openai/gpt-6.1-terra",
    freeModel: "nvidia/nemotron-3-ultra-550b-a55b:free",
    label: "⚡ Super-Blend Fusion (Multi-Model Synthesis)",
    why: "Combines multiple top AI specialists in parallel and synthesizes the strongest answer",
  },

  // 28. Universal default intelligent orchestrator
  default: {
    model: "openai/gpt-6-luna",
    freeModel: "cohere/north-mini-code:free",
    label: "GPT-6 Luna / North Mini Code (Default Master)",
    why: "Fast, reliable frontier generalist model for comprehensive orchestration",
  },
};

/**
 * Resolves the optimal model ID and metadata for a category based on account tier.
 */
function getModelForCategory(category, { freeTier = false } = {}) {
  const entry = MODEL_REGISTRY[category] || MODEL_REGISTRY.default;
  const resolvedId = freeTier ? (entry.freeModel || entry.model) : entry.model;
  return {
    ...entry,
    category: MODEL_REGISTRY[category] ? category : "default",
    model: resolvedId,
    paidModel: entry.model,
    freeModel: entry.freeModel,
  };
}

module.exports = { MODEL_REGISTRY, getModelForCategory };
