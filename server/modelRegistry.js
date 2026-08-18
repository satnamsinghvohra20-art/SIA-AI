/**
 * MODEL REGISTRY
 * ---------------
 * Maps a task category -> the model (OpenRouter model id) currently best
 * suited for it. This is the "brain" that decides who does what.
 *
 * Edit this file freely as new models come out — that's the whole point
 * of routing through OpenRouter: you swap one string instead of rewriting
 * integration code.
 *
 * Format: "openrouter/provider-slug/model-slug"
 * Browse live catalog + ids: https://openrouter.ai/models
 */

const MODEL_REGISTRY = {
  // Heavy coding, debugging, architecture, refactors
  coding: {
    model: "anthropic/claude-sonnet-4.5",
    label: "Claude Sonnet 4.5",
    why: "Best-in-class for real-world coding, long files, multi-step edits",
  },

  // Math, logic, multi-step reasoning, proofs, puzzles
  reasoning: {
    model: "openai/o3-mini",
    label: "OpenAI o3-mini",
    why: "Strongest deep chain-of-thought reasoning for hard problems",
  },

  // Long-form creative writing, storytelling, marketing copy
  creative: {
    model: "anthropic/claude-opus-4.1",
    label: "Claude Opus 4.1",
    why: "Best prose quality, tone control, and narrative coherence",
  },

  // Web research, current events, fact lookups with citations
  research: {
    model: "perplexity/sonar-pro",
    label: "Perplexity Sonar Pro",
    why: "Native web search with grounded, cited answers",
  },

  // Images, screenshots, charts, diagrams, visual understanding
  vision: {
    model: "google/gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    why: "Strongest multimodal understanding + huge context window",
  },

  // Very long documents / huge context dumps (contracts, codebases, books)
  long_context: {
    model: "google/gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    why: "Up to ~2M token context window",
  },

  // Fast, cheap, everyday chat — greetings, quick Q&A, simple tasks
  fast_general: {
    model: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    why: "Low latency, low cost, still strong quality for simple tasks",
  },

  // Structured data extraction, JSON, spreadsheets, tabular reasoning
  data: {
    model: "openai/gpt-4.1",
    label: "GPT-4.1",
    why: "Reliable structured output and tool-calling",
  },

  // Device-control agent loop — needs reliable tool/function calling
  device_control: {
    model: "openai/gpt-4.1",
    label: "GPT-4.1",
    why: "Reliable structured tool-calling for multi-step device actions",
  },

  // Deep chain-of-thought open reasoning
  deep_thinking: {
    model: "deepseek/deepseek-r1",
    label: "DeepSeek R1",
    why: "Open-weights deep reasoning with step-by-step thinking",
  },

  // Fast open-source general knowledge
  open_source: {
    model: "meta-llama/llama-3.3-70b-instruct",
    label: "Llama 3.3 70B",
    why: "Open-source flagship model from Meta",
  },

  // Fallback if classification is unsure
  default: {
    model: "anthropic/claude-sonnet-4.5",
    label: "Claude Sonnet 4.5",
    why: "Strong generalist default",
  },
};

module.exports = { MODEL_REGISTRY };
