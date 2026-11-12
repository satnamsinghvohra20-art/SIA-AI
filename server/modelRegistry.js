/**
 * Task-specialized OpenRouter models.
 * IDs are checked against the live catalog; update this shortlist as models change.
 */

const MODELS = {
  fast: "deepseek/deepseek-v4.1-flash",
  general: "openai/gpt-6.1-terra",
  flagship: "openai/gpt-6.1-sol",
  coding: "anthropic/claude-sonnet-5.5",
  reasoning: "anthropic/claude-opus-5.5",
  vision: "google/gemini-4-carbon",
  research: "perplexity/sonar",
  top: "anthropic/claude-fable-5.2",
  open: "moonshotai/kimi-k3.1-pro",
  multilingual: "qwen/qwen3.8-flash",
};

const MODEL_REGISTRY = {
  coding: {
    model: MODELS.coding,
    label: "Claude Sonnet 5.5 (Coding)",
    why: "Strong coding model for implementation, debugging, and architecture.",
  },
  coding_fast: {
    model: MODELS.fast,
    label: "DeepSeek V4.1 Flash (Fast Coding)",
    why: "Fast, low-cost model with coding support.",
  },
  coding_python: {
    model: MODELS.coding,
    label: "Claude Sonnet 5.5 (Python & Backend)",
    why: "Capable model for multi-step backend and Python work.",
  },
  reasoning: {
    model: MODELS.reasoning,
    label: "Claude Opus 5.5 (Reasoning)",
    why: "Flagship reasoning for difficult analytical tasks.",
  },
  deep_thinking: {
    model: MODELS.top,
    label: "Claude Fable 5.2 (Flagship)",
    why: "Top-ranked model by OpenRouter usage on the current leaderboard.",
  },
  fast_reasoning: {
    model: MODELS.fast,
    label: "DeepSeek V4.1 Flash (Fast Reasoning)",
    why: "Fast, low-cost reasoning for everyday logic and STEM questions.",
  },
  creative: {
    model: MODELS.coding,
    label: "Claude Sonnet 5.5 (Creative)",
    why: "Strong general-purpose writing and instruction following.",
  },
  creative_fast: {
    model: MODELS.general,
    label: "GPT-6.1 Terra (Fast Writing)",
    why: "Cost-efficient model for short drafts and rewrites.",
  },
  research: {
    model: MODELS.research,
    label: "Perplexity Sonar (Web Research)",
    why: "Web-search-oriented model that returns source citations.",
  },
  research_fast: {
    model: MODELS.research,
    label: "Perplexity Sonar (Quick Research)",
    why: "Fast web-backed answers with citations.",
  },
  vision: {
    model: MODELS.vision,
    label: "Gemini 4 Carbon (Vision)",
    why: "Multimodal model supporting images, documents, audio, and video.",
  },
  vision_fast: {
    model: MODELS.fast,
    label: "DeepSeek V4.1 Flash (Fast Vision)",
    why: "Low-cost image-capable model for straightforward visual questions.",
  },
  long_context: {
    model: MODELS.coding,
    label: "Claude Sonnet 5.5 (Long Context)",
    why: "Supports a one-million-token context window for long documents.",
  },
  fast_general: {
    model: MODELS.fast,
    label: "DeepSeek V4.1 Flash (Fast General)",
    why: "High-throughput, low-cost model for everyday questions.",
  },
  ultra_fast_chat: {
    model: MODELS.fast,
    label: "DeepSeek V4.1 Flash (Quick Chat)",
    why: "Lightweight option for short conversational requests.",
  },
  flagship_omni: {
    model: MODELS.top,
    label: "Claude Fable 5.2 (Flagship)",
    why: "High-capability model for difficult reasoning, coding, and long-context tasks.",
  },
  gpt_fast: {
    model: MODELS.general,
    label: "GPT-6.1 Terra (Fast General)",
    why: "Cost-efficient general model with structured-output support.",
  },
  data: {
    model: MODELS.general,
    label: "GPT-6.1 Terra (Structured Data)",
    why: "Supports structured outputs for extraction and data transformation.",
  },
  device_control: {
    model: MODELS.fast,
    label: "DeepSeek V4.1 Flash (Device Agent)",
    why: "Fast tool-calling model for the device-control agent.",
  },
  open_source: {
    model: MODELS.open,
    label: "Kimi K3.1 Pro (Open Weights)",
    why: "Open-weight multimodal reasoning model.",
  },
  open_source_giant: {
    model: MODELS.open,
    label: "Kimi K3.1 Pro (Open Weights)",
    why: "Open-weight multimodal model with a large context window.",
  },
  multilingual: {
    model: MODELS.multilingual,
    label: "Qwen 3.8 Flash (Multilingual)",
    why: "Multimodal model suited to multilingual and coding assistance.",
  },
  cybersecurity: {
    model: MODELS.coding,
    label: "Claude Sonnet 5.5 (Security Review)",
    why: "Strong code-analysis model for defensive security review.",
  },
  witty_unfiltered: {
    model: MODELS.general,
    label: "GPT-6.1 Terra (General)",
    why: "Cost-efficient model for conversational writing.",
  },
  math_science: {
    model: MODELS.reasoning,
    label: "Claude Opus 5.5 (Math & Science)",
    why: "High-capability model for complex mathematical and scientific reasoning.",
  },
  finance_business: {
    model: MODELS.general,
    label: "GPT-6.1 Terra (Business)",
    why: "Cost-efficient model for business documents and analysis.",
  },
  default: {
    model: MODELS.general,
    label: "GPT-6.1 Terra (Default)",
    why: "Balanced general model selected for cost and capability.",
  },
};

module.exports = { MODEL_REGISTRY };
