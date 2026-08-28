/**
 * MODEL REGISTRY (26+ Specialized AI Models)
 * --------------------------------------------
 * Maps each task category to the absolute best OpenRouter model
 * for that specific superpower, ensuring maximum speed, intelligence,
 * and accuracy with zero mistakes.
 *
 * Browse catalog: https://openrouter.ai/models
 */

const MODEL_REGISTRY = {
  // 1. Heavy coding, system architecture, refactoring & bug fixing
  coding: {
    model: "anthropic/claude-sonnet-5",
    label: "Claude Sonnet 5 (Coding Flagship)",
    why: "Industry-leading coding architecture, hybrid reasoning, and multi-file refactoring",
  },

  // 2. High-speed, high-accuracy code generation & scripting
  coding_fast: {
    model: "qwen/qwen-2.5-coder-32b-instruct",
    label: "Qwen 2.5 Coder 32B (Fast Code)",
    why: "Ultra-low latency, specialized for fast syntax, algorithms, and script generation",
  },

  // 3. Python, backend, APIs, databases & logic architecture
  coding_python: {
    model: "qwen/qwen-2.5-coder-32b-instruct",
    label: "Qwen 2.5 Coder 32B (Python & Backend)",
    why: "Deep code model optimized for Python, APIs, and backend logic",
  },

  // 4. Advanced mathematical reasoning, STEM proofs, hard logic
  reasoning: {
    model: "openai/o4-mini",
    label: "OpenAI o4-mini (STEM & Math)",
    why: "Deep multi-step reasoning, mathematical proofs, and logic puzzles",
  },

  // 5. Open deep chain-of-thought step-by-step reasoning
  deep_thinking: {
    model: "deepseek/deepseek-r1",
    label: "DeepSeek R1 (Deep Reasoning)",
    why: "Top-tier open reasoning model with transparent chain-of-thought thinking",
  },

  // 6. Fast open-source mathematical & logic reasoning
  fast_reasoning: {
    model: "deepseek/deepseek-r1-distill-llama-70b",
    label: "DeepSeek R1 Distill 70B (Fast Logic)",
    why: "Combines Llama 70B architecture with DeepSeek R1 reasoning speed",
  },

  // 7. Long-form creative writing, storytelling, essays, marketing copy
  creative: {
    model: "anthropic/claude-sonnet-5",
    label: "Claude Sonnet 5 (Creative & Prose)",
    why: "Masterful nuanced prose, narrative storytelling, and human-like eloquence",
  },

  // 8. High-speed brainstorming, slogans, creative copy & drafting
  creative_fast: {
    model: "anthropic/claude-haiku-4.5",
    label: "Claude Haiku 4.5 (Fast Creative)",
    why: "Ultra-fast creative drafting, brainstorming, and punchy copywriting",
  },

  // 9. Live web research with verified source citations & deep reasoning
  research: {
    model: "google/gemini-2.5-pro",
    label: "Gemini 2.5 Pro (Deep Research)",
    why: "Deep multimodal research and comprehensive factual exploration",
  },

  // 10. Instant real-time web search, current news & quick fact lookups
  research_fast: {
    model: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash (Fast Search)",
    why: "Sub-second search and synthesis for breaking news and quick facts",
  },

  // 11. Multimodal visual understanding (charts, diagrams, UI, complex images)
  vision: {
    model: "google/gemini-2.5-pro",
    label: "Gemini 2.5 Pro (Deep Vision)",
    why: "Google's flagship multimodal model for complex image analysis and diagrams",
  },

  // 12. Real-time visual OCR, screenshots & instant photo inspection
  vision_fast: {
    model: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash (Fast Vision/OCR)",
    why: "Instant image recognition, screenshot reading, and document OCR",
  },

  // 13. Massive 2M token context window (entire codebases, books, huge PDFs)
  long_context: {
    model: "google/gemini-2.5-pro",
    label: "Gemini 2.5 Pro (2M Token Context)",
    why: "Up to 2,000,000 token context window for massive document analysis",
  },

  // 14. High-speed general everyday knowledge & conversation
  fast_general: {
    model: "openai/gpt-5.4-mini",
    label: "GPT-5.4 Mini (Fast General)",
    why: "Sub-200ms latency, high reliability, and broad general knowledge",
  },

  // 15. Lowest latency instant conversational chat (<100ms)
  ultra_fast_chat: {
    model: "openai/gpt-4o-mini",
    label: "GPT-4o Mini (Ultra-Fast)",
    why: "Extreme low latency for quick greetings, one-liner answers, and rapid dialogue",
  },

  // 16. OpenAI flagship multimodal intelligence
  flagship_omni: {
    model: "openai/gpt-5.5",
    label: "GPT-5.5 (Flagship Omni)",
    why: "High-capability multimodal reasoning and natural conversational intelligence",
  },

  // 17. Fast and efficient everyday OpenAI tasks
  gpt_fast: {
    model: "openai/gpt-5.4-mini",
    label: "GPT-5.4 Mini (Fast General)",
    why: "Lightweight, highly capable model for rapid daily tasks and summaries",
  },

  // 18. Structured JSON, tabular data, CSV parsing & schema validation
  data: {
    model: "openai/gpt-5.4-mini",
    label: "GPT-5.4 Mini (Structured Data & JSON)",
    why: "Flawless structured JSON extraction and deterministic schema mapping",
  },

  // 19. Device-control agent loop (tool calling for Edge, Windows & Mobile)
  device_control: {
    model: "openai/gpt-4o-mini",
    label: "GPT-4o Mini (Device & Tool Agent)",
    why: "Gold standard for ultra-fast OpenAI function/tool calling and multi-step device actions",
  },

  // 20. Meta's open-weights flagship foundation model
  open_source: {
    model: "meta-llama/llama-3.3-70b-instruct",
    label: "Llama 3.3 70B (Meta Open Source)",
    why: "Meta's flagship open-weights model with world-class general intelligence",
  },

  // 21. The world's largest open foundation model (70B parameter fast)
  open_source_giant: {
    model: "meta-llama/llama-3.1-70b-instruct",
    label: "Llama 3.1 70B (Open Source Giant)",
    why: "Massive 70B parameter open model with superior reasoning capabilities",
  },

  // 22. Multilingual translation, cross-language reasoning & global dialect
  multilingual: {
    model: "qwen/qwen-2.5-72b-instruct",
    label: "Qwen 2.5 72B (Multilingual & Global)",
    why: "Superior multilingual fluency across 100+ languages and translation",
  },

  // 23. Cybersecurity, code vulnerability auditing & enterprise logic
  cybersecurity: {
    model: "meta-llama/llama-3.3-70b-instruct",
    label: "Llama 3.3 70B (Security & Audit)",
    why: "Specialized in security auditing, rigorous logical critique, and enterprise workloads",
  },

  // 24. Truth-seeking, witty real-time intelligence
  witty_unfiltered: {
    model: "meta-llama/llama-3.3-70b-instruct",
    label: "Llama 3.3 70B (Witty & Unfiltered)",
    why: "Open weights foundation model with witty personality and high agility",
  },

  // 25. High-speed scientific calculations & DeepSeek V3 general intelligence
  math_science: {
    model: "deepseek/deepseek-chat",
    label: "DeepSeek V3 (Science & Calculations)",
    why: "Next-generation 671B MoE model for scientific and analytical tasks",
  },

  // 26. Enterprise strategy, financial reports, contract analysis
  finance_business: {
    model: "openai/gpt-5.4-mini",
    label: "GPT-5.4 Mini (Business & Finance)",
    why: "Optimized for enterprise documents, financial summaries, and business intelligence",
  },

  // 27. Universal default intelligent orchestrator
  default: {
    model: "openai/gpt-5.4-mini",
    label: "GPT-5.4 Mini (Default Master)",
    why: "The premier frontier generalist model for comprehensive task orchestration",
  },
};

module.exports = { MODEL_REGISTRY };
