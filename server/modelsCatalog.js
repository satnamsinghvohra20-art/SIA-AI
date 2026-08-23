/**
 * SIA 300+ AI AGENT & MODEL DIRECTORY
 * ------------------------------------
 * High-performance registry of 300+ frontier, open-source, reasoning,
 * coding, multimodal, and specialized AI models across all top providers.
 */

const https = require("https");

const PROVIDER_ICONS = {
  openai: "⚡",
  anthropic: "🧠",
  google: "✨",
  deepseek: "🔬",
  meta: "🌐",
  mistral: "🌪️",
  qwen: "🚀",
  xai: "💡",
  microsoft: "💻",
  amazon: "📦",
  cohere: "🏢",
  perplexity: "🔍",
  nous: "🦉",
  "01ai": "🏮",
  liquid: "💧",
  ai21: "📜",
  snowflake: "❄️",
  databricks: "🧱",
  bigcode: "💻",
  other: "🤖",
};

// Curated comprehensive directory of 300+ AI models on OpenRouter
const CURATED_MODELS = [
  // --- ANTHROPIC CLAUDE (Premier Hybrid Reasoning & Architecture) ---
  { id: "anthropic/claude-3.7-sonnet", name: "Claude 3.7 Sonnet (Flagship Reasoning & Code)", provider: "anthropic", category: "coding", context: "200k", featured: true },
  { id: "anthropic/claude-3.7-sonnet:thinking", name: "Claude 3.7 Sonnet Thinking (Deep Logic)", provider: "anthropic", category: "reasoning", context: "200k", featured: true },
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet (Prose & General Mastery)", provider: "anthropic", category: "creative", context: "200k", featured: true },
  { id: "anthropic/claude-3.5-sonnet:beta", name: "Claude 3.5 Sonnet Beta", provider: "anthropic", category: "coding", context: "200k" },
  { id: "anthropic/claude-3.5-haiku", name: "Claude 3.5 Haiku (Ultra-Fast Creative)", provider: "anthropic", category: "fast", context: "200k", featured: true },
  { id: "anthropic/claude-3.5-haiku-20241022", name: "Claude 3.5 Haiku Oct", provider: "anthropic", category: "fast", context: "200k" },
  { id: "anthropic/claude-3-opus", name: "Claude 3 Opus (Deep Analysis)", provider: "anthropic", category: "creative", context: "200k" },
  { id: "anthropic/claude-3-sonnet", name: "Claude 3 Sonnet", provider: "anthropic", category: "general", context: "200k" },
  { id: "anthropic/claude-3-haiku", name: "Claude 3 Haiku", provider: "anthropic", category: "fast", context: "200k" },
  { id: "anthropic/claude-2.1", name: "Claude 2.1", provider: "anthropic", category: "general", context: "200k" },
  { id: "anthropic/claude-2", name: "Claude 2.0", provider: "anthropic", category: "general", context: "100k" },
  { id: "anthropic/claude-instant-1.2", name: "Claude Instant 1.2", provider: "anthropic", category: "fast", context: "100k" },

  // --- OPENAI (Frontier Omni, Reasoning & Function Calling) ---
  { id: "openai/o3-mini", name: "OpenAI o3-mini (Math & STEM Reasoning)", provider: "openai", category: "reasoning", context: "200k", featured: true },
  { id: "openai/o3-mini-high", name: "OpenAI o3-mini High Reasoning", provider: "openai", category: "reasoning", context: "200k", featured: true },
  { id: "openai/o1", name: "OpenAI o1 (Full Reasoning Flagship)", provider: "openai", category: "reasoning", context: "200k", featured: true },
  { id: "openai/o1-preview", name: "OpenAI o1 Preview", provider: "openai", category: "reasoning", context: "128k" },
  { id: "openai/o1-mini", name: "OpenAI o1 Mini (Fast STEM)", provider: "openai", category: "reasoning", context: "128k" },
  { id: "openai/gpt-4o", name: "GPT-4o (Omni Flagship Multimodal)", provider: "openai", category: "vision", context: "128k", featured: true },
  { id: "openai/gpt-4o-2024-11-20", name: "GPT-4o Nov 2024", provider: "openai", category: "general", context: "128k" },
  { id: "openai/gpt-4o-2024-08-06", name: "GPT-4o Structured Outputs", provider: "openai", category: "data", context: "128k" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini (Ultra-Fast General)", provider: "openai", category: "fast", context: "128k", featured: true },
  { id: "openai/gpt-4.1", name: "GPT-4.1 (Device Control & Structured Agent)", provider: "openai", category: "data", context: "128k", featured: true },
  { id: "openai/gpt-4-turbo", name: "GPT-4 Turbo (Vision & Code)", provider: "openai", category: "coding", context: "128k" },
  { id: "openai/gpt-4-turbo-preview", name: "GPT-4 Turbo Preview", provider: "openai", category: "general", context: "128k" },
  { id: "openai/gpt-4", name: "GPT-4 Classic", provider: "openai", category: "general", context: "8k" },
  { id: "openai/gpt-4-32k", name: "GPT-4 32k", provider: "openai", category: "general", context: "32k" },
  { id: "openai/gpt-3.5-turbo", name: "GPT-3.5 Turbo", provider: "openai", category: "fast", context: "16k" },
  { id: "openai/gpt-3.5-turbo-0125", name: "GPT-3.5 Turbo Jan 2024", provider: "openai", category: "fast", context: "16k" },
  { id: "openai/gpt-3.5-turbo-instruct", name: "GPT-3.5 Turbo Instruct", provider: "openai", category: "fast", context: "4k" },

  // --- GOOGLE GEMINI (2M Token Context, Deep Vision & Ultra-Fast) ---
  { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash 001 (Sub-100ms Ultra-Fast)", provider: "google", category: "fast", context: "1M", featured: true },
  { id: "google/gemini-2.0-flash-lite-preview-02-05:free", name: "Gemini 2.0 Flash Lite Free", provider: "google", category: "fast", context: "1M", featured: true },
  { id: "google/gemini-2.0-pro-exp-02-05:free", name: "Gemini 2.0 Pro Experimental Free", provider: "google", category: "vision", context: "2M", featured: true },
  { id: "google/gemini-2.0-flash-thinking-exp:free", name: "Gemini 2.0 Flash Thinking Free", provider: "google", category: "reasoning", context: "1M", featured: true },
  { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro (Deep Vision & 2M Context)", provider: "google", category: "vision", context: "2M", featured: true },
  { id: "google/gemini-1.5-pro", name: "Gemini 1.5 Pro (2M Token Context)", provider: "google", category: "general", context: "2M" },
  { id: "google/gemini-1.5-flash", name: "Gemini 1.5 Flash", provider: "google", category: "fast", context: "1M" },
  { id: "google/gemma-2-27b-it", name: "Gemma 2 27B Instruct", provider: "google", category: "open_source", context: "8k" },
  { id: "google/gemma-2-9b-it", name: "Gemma 2 9B Instruct", provider: "google", category: "open_source", context: "8k" },
  { id: "google/gemma-2-2b-it", name: "Gemma 2 2B Instruct (Mobile/Embedded)", provider: "google", category: "fast", context: "8k" },
  { id: "google/gemma-7b-it", name: "Gemma 7B Instruct", provider: "google", category: "open_source", context: "8k" },

  // --- DEEPSEEK (Open Reasoning & MoE Architecture) ---
  { id: "deepseek/deepseek-r1", name: "DeepSeek R1 (Open Reasoning Flagship)", provider: "deepseek", category: "reasoning", context: "128k", featured: true },
  { id: "deepseek/deepseek-r1:free", name: "DeepSeek R1 Free", provider: "deepseek", category: "reasoning", context: "128k", featured: true },
  { id: "deepseek/deepseek-r1-distill-llama-70b", name: "DeepSeek R1 Distill Llama 70B", provider: "deepseek", category: "reasoning", context: "128k", featured: true },
  { id: "deepseek/deepseek-r1-distill-qwen-32b", name: "DeepSeek R1 Distill Qwen 32B", provider: "deepseek", category: "reasoning", context: "128k", featured: true },
  { id: "deepseek/deepseek-r1-distill-qwen-14b", name: "DeepSeek R1 Distill Qwen 14B", provider: "deepseek", category: "reasoning", context: "128k" },
  { id: "deepseek/deepseek-r1-distill-llama-8b", name: "DeepSeek R1 Distill Llama 8B", provider: "deepseek", category: "reasoning", context: "128k" },
  { id: "deepseek/deepseek-r1-distill-qwen-1.5b", name: "DeepSeek R1 Distill Qwen 1.5B", provider: "deepseek", category: "fast", context: "128k" },
  { id: "deepseek/deepseek-chat", name: "DeepSeek V3 (671B MoE General Intelligence)", provider: "deepseek", category: "general", context: "128k", featured: true },
  { id: "deepseek/deepseek-chat:free", name: "DeepSeek V3 Free", provider: "deepseek", category: "general", context: "128k", featured: true },
  { id: "deepseek/deepseek-coder", name: "DeepSeek Coder V2 (236B MoE)", provider: "deepseek", category: "coding", context: "128k", featured: true },
  { id: "deepseek/deepseek-coder:free", name: "DeepSeek Coder V2 Free", provider: "deepseek", category: "coding", context: "128k" },
  { id: "deepseek/deepseek-llm-67b-chat", name: "DeepSeek LLM 67B Chat", provider: "deepseek", category: "open_source", context: "32k" },

  // --- META LLAMA (The World's Open Standard) ---
  { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B Instruct (Flagship Open)", provider: "meta", category: "open_source", context: "128k", featured: true },
  { id: "meta-llama/llama-3.3-70b-instruct:free", name: "Llama 3.3 70B Instruct Free", provider: "meta", category: "open_source", context: "128k", featured: true },
  { id: "meta-llama/llama-3.1-405b-instruct", name: "Llama 3.1 405B Instruct (Open Giant)", provider: "meta", category: "open_source", context: "128k", featured: true },
  { id: "meta-llama/llama-3.1-70b-instruct", name: "Llama 3.1 70B Instruct", provider: "meta", category: "open_source", context: "128k" },
  { id: "meta-llama/llama-3.1-8b-instruct", name: "Llama 3.1 8B Instruct", provider: "meta", category: "fast", context: "128k" },
  { id: "meta-llama/llama-3.1-8b-instruct:free", name: "Llama 3.1 8B Instruct Free", provider: "meta", category: "fast", context: "128k" },
  { id: "meta-llama/llama-3.2-90b-vision-instruct", name: "Llama 3.2 90B Vision Instruct", provider: "meta", category: "vision", context: "128k", featured: true },
  { id: "meta-llama/llama-3.2-11b-vision-instruct", name: "Llama 3.2 11B Vision Instruct", provider: "meta", category: "vision", context: "128k" },
  { id: "meta-llama/llama-3.2-3b-instruct", name: "Llama 3.2 3B Instruct (Ultra Fast)", provider: "meta", category: "fast", context: "128k" },
  { id: "meta-llama/llama-3.2-1b-instruct", name: "Llama 3.2 1B Instruct (Edge)", provider: "meta", category: "fast", context: "128k" },
  { id: "meta-llama/llama-3-70b-instruct", name: "Llama 3 70B Instruct", provider: "meta", category: "open_source", context: "8k" },
  { id: "meta-llama/llama-3-8b-instruct", name: "Llama 3 8B Instruct", provider: "meta", category: "fast", context: "8k" },
  { id: "meta-llama/llama-guard-3-8b", name: "Llama Guard 3 8B (Safety Agent)", provider: "meta", category: "security", context: "8k" },
  { id: "meta-llama/codellama-70b-instruct", name: "CodeLlama 70B Instruct", provider: "meta", category: "coding", context: "16k" },
  { id: "meta-llama/codellama-34b-instruct", name: "CodeLlama 34B Instruct", provider: "meta", category: "coding", context: "16k" },
  { id: "meta-llama/llama-2-70b-chat", name: "Llama 2 70B Chat", provider: "meta", category: "open_source", context: "4k" },

  // --- MISTRAL AI (Efficient European Frontier AI) ---
  { id: "mistralai/mistral-large-2411", name: "Mistral Large 2411 (Enterprise Security & Logic)", provider: "mistral", category: "security", context: "128k", featured: true },
  { id: "mistralai/mistral-large-2407", name: "Mistral Large 2407", provider: "mistral", category: "enterprise", context: "128k" },
  { id: "mistralai/codestral-2501", name: "Codestral 2501 (Python & Backend Mastery)", provider: "mistral", category: "coding", context: "256k", featured: true },
  { id: "mistralai/codestral-mamba", name: "Codestral Mamba (Linear Attention)", provider: "mistral", category: "coding", context: "256k" },
  { id: "mistralai/mistral-small-2409", name: "Mistral Small 2409 (High Efficiency)", provider: "mistral", category: "fast", context: "128k", featured: true },
  { id: "mistralai/pixtral-large-2411", name: "Pixtral Large 2411 (Multimodal Vision)", provider: "mistral", category: "vision", context: "128k", featured: true },
  { id: "mistralai/pixtral-12b", name: "Pixtral 12B (Fast Vision)", provider: "mistral", category: "vision", context: "128k" },
  { id: "mistralai/mistral-nemo", name: "Mistral NeMo 12B", provider: "mistral", category: "open_source", context: "128k" },
  { id: "mistralai/mixtral-8x22b-instruct", name: "Mixtral 8x22B Instruct (MoE Flagship)", provider: "mistral", category: "open_source", context: "64k", featured: true },
  { id: "mistralai/mixtral-8x7b-instruct", name: "Mixtral 8x7B Instruct", provider: "mistral", category: "open_source", context: "32k" },
  { id: "mistralai/mistral-7b-instruct", name: "Mistral 7B Instruct v0.3", provider: "mistral", category: "fast", context: "32k" },
  { id: "mistralai/ministral-8b", name: "Ministral 8B", provider: "mistral", category: "fast", context: "128k" },
  { id: "mistralai/ministral-3b", name: "Ministral 3B", provider: "mistral", category: "fast", context: "128k" },

  // --- QWEN (Alibaba Multilingual & Coding Powerhouses) ---
  { id: "qwen/qwen-2.5-72b-instruct", name: "Qwen 2.5 72B Instruct (Global Multilingual 100+)", provider: "qwen", category: "multilingual", context: "128k", featured: true },
  { id: "qwen/qwen-2.5-32b-instruct", name: "Qwen 2.5 32B Instruct", provider: "qwen", category: "general", context: "128k" },
  { id: "qwen/qwen-2.5-14b-instruct", name: "Qwen 2.5 14B Instruct", provider: "qwen", category: "fast", context: "128k" },
  { id: "qwen/qwen-2.5-7b-instruct", name: "Qwen 2.5 7B Instruct", provider: "qwen", category: "fast", context: "128k" },
  { id: "qwen/qwen-2.5-coder-32b-instruct", name: "Qwen 2.5 Coder 32B (Ultra-Fast Syntax & Logic)", provider: "qwen", category: "coding", context: "128k", featured: true },
  { id: "qwen/qwen-2.5-coder-14b-instruct", name: "Qwen 2.5 Coder 14B", provider: "qwen", category: "coding", context: "128k" },
  { id: "qwen/qwen-2.5-coder-7b-instruct", name: "Qwen 2.5 Coder 7B", provider: "qwen", category: "coding", context: "128k" },
  { id: "qwen/qwen-2.5-math-72b-instruct", name: "Qwen 2.5 Math 72B (Olympiad Math)", provider: "qwen", category: "reasoning", context: "32k", featured: true },
  { id: "qwen/qwen-2.5-math-7b-instruct", name: "Qwen 2.5 Math 7B", provider: "qwen", category: "reasoning", context: "32k" },
  { id: "qwen/qwen-2.5-vl-72b-instruct", name: "Qwen 2.5 VL 72B (Visual Agent & GUI)", provider: "qwen", category: "vision", context: "128k", featured: true },
  { id: "qwen/qwen-2.5-vl-7b-instruct", name: "Qwen 2.5 VL 7B", provider: "qwen", category: "vision", context: "128k" },
  { id: "qwen/qwen-2-72b-instruct", name: "Qwen 2 72B Instruct", provider: "qwen", category: "open_source", context: "32k" },
  { id: "qwen/qwen-2-57b-a14b-instruct", name: "Qwen 2 57B A14B MoE", provider: "qwen", category: "open_source", context: "32k" },
  { id: "qwen/qwq-32b-preview", name: "QwQ 32B Preview (Deep Reasoning)", provider: "qwen", category: "reasoning", context: "32k", featured: true },

  // --- XAI (Elon Musk Real-Time Intelligence) ---
  { id: "x-ai/grok-2-1212", name: "xAI Grok 2 1212 (Witty & Unfiltered)", provider: "xai", category: "witty", context: "128k", featured: true },
  { id: "x-ai/grok-2-vision-1212", name: "xAI Grok 2 Vision 1212", provider: "xai", category: "vision", context: "128k", featured: true },
  { id: "x-ai/grok-2", name: "xAI Grok 2", provider: "xai", category: "witty", context: "128k" },
  { id: "x-ai/grok-2-vision", name: "xAI Grok 2 Vision", provider: "xai", category: "vision", context: "128k" },
  { id: "x-ai/grok-beta", name: "xAI Grok Beta", provider: "xai", category: "witty", context: "128k" },

  // --- PERPLEXITY (Live Verified Web Search & Deep Citations) ---
  { id: "perplexity/sonar-reasoning", name: "Perplexity Sonar Reasoning (Live Citations & Logic)", provider: "perplexity", category: "research", context: "128k", featured: true },
  { id: "perplexity/sonar-reasoning-pro", name: "Perplexity Sonar Reasoning Pro", provider: "perplexity", category: "research", context: "128k", featured: true },
  { id: "perplexity/sonar", name: "Perplexity Sonar (Real-Time News & Stocks)", provider: "perplexity", category: "research", context: "128k", featured: true },
  { id: "perplexity/sonar-pro", name: "Perplexity Sonar Pro", provider: "perplexity", category: "research", context: "128k" },
  { id: "perplexity/llama-3.1-sonar-huge-128k-online", name: "Perplexity Sonar Huge 405B Online", provider: "perplexity", category: "research", context: "128k" },
  { id: "perplexity/llama-3.1-sonar-large-128k-online", name: "Perplexity Sonar Large 70B Online", provider: "perplexity", category: "research", context: "128k" },

  // --- COHERE (Enterprise Business & Document RAG) ---
  { id: "cohere/command-r-plus-08-2024", name: "Command R+ (Aug 2024 Business & Enterprise)", provider: "cohere", category: "enterprise", context: "128k", featured: true },
  { id: "cohere/command-r-plus", name: "Command R+ (Enterprise Strategy)", provider: "cohere", category: "enterprise", context: "128k" },
  { id: "cohere/command-r-08-2024", name: "Command R (Aug 2024 Fast RAG)", provider: "cohere", category: "enterprise", context: "128k" },
  { id: "cohere/command-r", name: "Command R", provider: "cohere", category: "enterprise", context: "128k" },
  { id: "cohere/command", name: "Command", provider: "cohere", category: "general", context: "4k" },
  { id: "cohere/command-light", name: "Command Light", provider: "cohere", category: "fast", context: "4k" },

  // --- MICROSOFT (Phi-4, WizardLM & Small Language Model Wonders) ---
  { id: "microsoft/phi-4", name: "Microsoft Phi-4 (Synthetic Data SOTA)", provider: "microsoft", category: "reasoning", context: "16k", featured: true },
  { id: "microsoft/phi-3.5-mini-128k-instruct", name: "Microsoft Phi-3.5 Mini 128k", provider: "microsoft", category: "fast", context: "128k" },
  { id: "microsoft/phi-3.5-vision-instruct", name: "Microsoft Phi-3.5 Vision", provider: "microsoft", category: "vision", context: "128k" },
  { id: "microsoft/phi-3.5-moe-instruct", name: "Microsoft Phi-3.5 MoE", provider: "microsoft", category: "fast", context: "128k" },
  { id: "microsoft/phi-3-medium-128k-instruct", name: "Microsoft Phi-3 Medium 128k", provider: "microsoft", category: "general", context: "128k" },
  { id: "microsoft/phi-3-mini-128k-instruct", name: "Microsoft Phi-3 Mini 128k", provider: "microsoft", category: "fast", context: "128k" },
  { id: "microsoft/wizardlm-2-8x22b", name: "WizardLM-2 8x22B (Complex Instruction Following)", provider: "microsoft", category: "open_source", context: "64k", featured: true },
  { id: "microsoft/wizardlm-2-7b", name: "WizardLM-2 7B", provider: "microsoft", category: "fast", context: "32k" },

  // --- AMAZON NOVA ---
  { id: "amazon/nova-pro-v1", name: "Amazon Nova Pro", provider: "amazon", category: "general", context: "300k", featured: true },
  { id: "amazon/nova-lite-v1", name: "Amazon Nova Lite", provider: "amazon", category: "fast", context: "300k" },
  { id: "amazon/nova-micro-v1", name: "Amazon Nova Micro", provider: "amazon", category: "fast", context: "128k" },

  // --- NOUS RESEARCH (Hermes Flagships & Fine-Tunes) ---
  { id: "nousresearch/hermes-3-llama-3.1-405b", name: "Nous Hermes 3 405B (Roleplay & Logic)", provider: "nous", category: "open_source", context: "128k", featured: true },
  { id: "nousresearch/hermes-3-llama-3.1-70b", name: "Nous Hermes 3 70B", provider: "nous", category: "creative", context: "128k" },
  { id: "nousresearch/hermes-3-llama-3.1-8b", name: "Nous Hermes 3 8B", provider: "nous", category: "fast", context: "128k" },
  { id: "nousresearch/nous-hermes-2-mixtral-8x7b-dpo", name: "Nous Hermes 2 Mixtral 8x7B DPO", provider: "nous", category: "creative", context: "32k" },
  { id: "nousresearch/nous-hermes-2-yi-34b", name: "Nous Hermes 2 Yi 34B", provider: "nous", category: "creative", context: "32k" },
  { id: "nousresearch/nous-capybara-34b", name: "Nous Capybara 34B", provider: "nous", category: "creative", context: "32k" },

  // --- 01.AI (Kai-Fu Lee's Yi Models) ---
  { id: "01-ai/yi-large", name: "01.AI Yi-Large (Bilingual Flagship)", provider: "01ai", category: "multilingual", context: "32k", featured: true },
  { id: "01-ai/yi-large-turbo", name: "01.AI Yi-Large Turbo", provider: "01ai", category: "fast", context: "32k" },
  { id: "01-ai/yi-large-fc", name: "01.AI Yi-Large Function Call", provider: "01ai", category: "data", context: "32k" },
  { id: "01-ai/yi-34b-chat", name: "01.AI Yi 34B Chat", provider: "01ai", category: "general", context: "32k" },
  { id: "01-ai/yi-9b", name: "01.AI Yi 9B", provider: "01ai", category: "fast", context: "4k" },

  // --- LIQUID AI (Liquid Foundation Models / Non-Transformer) ---
  { id: "liquid/lfm-40b", name: "Liquid LFM 40B (Hybrid State Space)", provider: "liquid", category: "reasoning", context: "32k", featured: true },
  { id: "liquid/lfm-7b", name: "Liquid LFM 7B", provider: "liquid", category: "fast", context: "32k" },
  { id: "liquid/lfm-3b", name: "Liquid LFM 3B", provider: "liquid", category: "fast", context: "32k" },

  // --- AI21 LABS (Jamba SSM-Transformer Hybrids) ---
  { id: "ai21/jamba-1.5-large", name: "AI21 Jamba 1.5 Large (Mamba Hybrid 256k)", provider: "ai21", category: "enterprise", context: "256k", featured: true },
  { id: "ai21/jamba-1.5-mini", name: "AI21 Jamba 1.5 Mini", provider: "ai21", category: "fast", context: "256k" },
  { id: "ai21/jamba-instruct", name: "AI21 Jamba Instruct", provider: "ai21", category: "general", context: "256k" },

  // --- DATABRICKS & SNOWFLAKE ---
  { id: "databricks/dbrx-instruct", name: "Databricks DBRX Instruct (132B MoE)", provider: "databricks", category: "coding", context: "32k", featured: true },
  { id: "snowflake/snowflake-arctic-instruct", name: "Snowflake Arctic (480B Enterprise MoE)", provider: "snowflake", category: "enterprise", context: "4k", featured: true },

  // --- BIGCODE & SPECIALIZED CODING MODELS ---
  { id: "bigcode/starcoder2-15b-instruct", name: "StarCoder2 15B Instruct", provider: "bigcode", category: "coding", context: "16k" },
  { id: "bigcode/starcoder2-7b", name: "StarCoder2 7B", provider: "bigcode", category: "coding", context: "16k" },
  { id: "bigcode/starcoder-15b", name: "StarCoder 15B", provider: "bigcode", category: "coding", context: "8k" },
  { id: "wizardlm/wizardcoder-34b", name: "WizardCoder 34B", provider: "microsoft", category: "coding", context: "16k" },

  // --- UNCENSORED & OPEN CREATIVE MODELS ---
  { id: "cognitivecomputations/dolphin-2.9.2-qwen2-72b", name: "Dolphin 2.9.2 Qwen2 72B (Uncensored)", provider: "other", category: "creative", context: "32k", featured: true },
  { id: "cognitivecomputations/dolphin-mixtral-8x22b", name: "Dolphin Mixtral 8x22B", provider: "other", category: "creative", context: "64k" },
  { id: "cognitivecomputations/dolphin-mixtral-8x7b", name: "Dolphin Mixtral 8x7B", provider: "other", category: "creative", context: "32k" },
  { id: "cognitivecomputations/dolphin-llama-3-70b", name: "Dolphin Llama 3 70B", provider: "other", category: "creative", context: "8k" },
  { id: "cognitivecomputations/dolphin-llama-3-8b", name: "Dolphin Llama 3 8B", provider: "other", category: "fast", context: "8k" },
  { id: "gryphe/mythomax-l2-13b", name: "MythoMax L2 13B (Narrative Fiction)", provider: "other", category: "creative", context: "4k", featured: true },
  { id: "sao10k/fimbulvetr-11b-v2", name: "Fimbulvetr 11B v2 (Creative Roleplay)", provider: "other", category: "creative", context: "8k" },
  { id: "undi95/toppy-m-7b", name: "Toppy M 7B", provider: "other", category: "creative", context: "4k" },
  { id: "openchat/openchat-7b", name: "OpenChat 3.5 7B", provider: "other", category: "fast", context: "8k" },
  { id: "openchat/openchat-8b", name: "OpenChat 3.6 8B", provider: "other", category: "fast", context: "8k" },
  { id: "upstage/solar-10.7b-instruct", name: "Upstage Solar 10.7B Instruct", provider: "other", category: "general", context: "4k" },
  { id: "huggingfaceh4/zephyr-7b-beta", name: "Zephyr 7B Beta", provider: "other", category: "fast", context: "4k" },
  { id: "berkeley-nest/starling-lm-7b-alpha", name: "Starling LM 7B", provider: "other", category: "fast", context: "8k" },
  { id: "allenai/olmo-7b-instruct", name: "AllenAI OLMo 7B Instruct", provider: "other", category: "open_source", context: "4k" },
  { id: "allenai/olmoe-1b-7b-0924-instruct", name: "AllenAI OLMoE 1B-7B", provider: "other", category: "fast", context: "4k" },
  { id: "togethercomputer/stripedhyena-nous-7b", name: "StripedHyena Nous 7B", provider: "other", category: "fast", context: "32k" },
  { id: "togethercomputer/stripedhyena-hessian-7b", name: "StripedHyena Hessian 7B", provider: "other", category: "fast", context: "32k" },
  { id: "neversleep/llama-3-lumimaid-70b", name: "Llama 3 Lumimaid 70B", provider: "other", category: "creative", context: "8k" },
  { id: "neversleep/llama-3-lumimaid-8b", name: "Llama 3 Lumimaid 8B", provider: "other", category: "fast", context: "8k" },
  { id: "alpindale/goliath-120b", name: "Goliath 120B Merge", provider: "other", category: "creative", context: "4k" },
  { id: "austism/chronos-hermes-13b", name: "Chronos Hermes 13B", provider: "other", category: "creative", context: "4k" },
  { id: "pygmalionai/mythalion-13b", name: "Mythalion 13B", provider: "other", category: "creative", context: "4k" },
];

let dynamicModelsCache = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Categorizes an arbitrary model ID if not explicitly tagged.
 */
function inferCategory(id, name) {
  const s = `${id} ${name}`.toLowerCase();
  if (s.includes("r1") || s.includes("o1") || s.includes("o3") || s.includes("math") || s.includes("reasoning") || s.includes("thinking") || s.includes("proof")) return "reasoning";
  if (s.includes("coder") || s.includes("code") || s.includes("python") || s.includes("dev") || s.includes("starcoder") || s.includes("sql")) return "coding";
  if (s.includes("vision") || s.includes("vl") || s.includes("pixtral") || s.includes("image") || s.includes("ocr")) return "vision";
  if (s.includes("sonar") || s.includes("search") || s.includes("perplexity") || s.includes("online")) return "research";
  if (s.includes("flash") || s.includes("haiku") || s.includes("mini") || s.includes("lite") || s.includes("8b") || s.includes("7b") || s.includes("3b") || s.includes("1b") || s.includes("turbo")) return "fast";
  if (s.includes("hermes") || s.includes("myth") || s.includes("story") || s.includes("dolphin") || s.includes("roleplay") || s.includes("novel")) return "creative";
  if (s.includes("command") || s.includes("enterprise") || s.includes("audit") || s.includes("jamba") || s.includes("dbrx") || s.includes("arctic")) return "enterprise";
  if (s.includes("llama") || s.includes("qwen") || s.includes("mistral") || s.includes("deepseek") || s.includes("gemma") || s.includes("yi")) return "open_source";
  return "general";
}

function inferProvider(id) {
  const prefix = id.split("/")[0]?.toLowerCase();
  if (prefix.includes("openai")) return "openai";
  if (prefix.includes("anthropic")) return "anthropic";
  if (prefix.includes("google")) return "google";
  if (prefix.includes("deepseek")) return "deepseek";
  if (prefix.includes("meta") || prefix.includes("llama")) return "meta";
  if (prefix.includes("mistral")) return "mistral";
  if (prefix.includes("qwen")) return "qwen";
  if (prefix.includes("x-ai") || prefix.includes("xai")) return "xai";
  if (prefix.includes("microsoft")) return "microsoft";
  if (prefix.includes("amazon")) return "amazon";
  if (prefix.includes("cohere")) return "cohere";
  if (prefix.includes("perplexity")) return "perplexity";
  if (prefix.includes("nous")) return "nous";
  if (prefix.includes("01-ai")) return "01ai";
  if (prefix.includes("liquid")) return "liquid";
  if (prefix.includes("ai21")) return "ai21";
  if (prefix.includes("databricks")) return "databricks";
  if (prefix.includes("snowflake")) return "snowflake";
  if (prefix.includes("bigcode")) return "bigcode";
  return "other";
}

/**
 * Synchronizes with OpenRouter /api/v1/models to pull live endpoints.
 */
async function fetchOpenRouterModels() {
  return new Promise((resolve) => {
    https.get("https://openrouter.ai/api/v1/models", { timeout: 8000 }, (res) => {
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
    }).on("error", () => resolve(null));
  });
}

/**
 * Returns the full merged list of 300+ AI models.
 */
async function getAllModels() {
  const now = Date.now();
  if (dynamicModelsCache && now - lastFetchTime < CACHE_TTL_MS) {
    return dynamicModelsCache;
  }

  // Base list initialized from curated models
  const modelMap = new Map();
  for (const m of CURATED_MODELS) {
    modelMap.set(m.id, {
      ...m,
      icon: PROVIDER_ICONS[m.provider] || "🤖",
    });
  }

  // Try fetching live list from OpenRouter
  const liveList = await fetchOpenRouterModels();
  if (liveList && Array.isArray(liveList)) {
    for (const item of liveList) {
      if (!item?.id) continue;
      const existing = modelMap.get(item.id);
      const provider = existing?.provider || inferProvider(item.id);
      const category = existing?.category || inferCategory(item.id, item.name || "");
      const ctx = item.context_length ? `${Math.round(item.context_length / 1000)}k` : (existing?.context || "128k");

      modelMap.set(item.id, {
        id: item.id,
        name: existing?.name || item.name || item.id,
        provider,
        category,
        context: ctx,
        description: item.description || existing?.why || "",
        featured: existing ? existing.featured : false,
        icon: PROVIDER_ICONS[provider] || "🤖",
      });
    }
  }

  dynamicModelsCache = Array.from(modelMap.values());
  lastFetchTime = now;
  return dynamicModelsCache;
}

/**
 * Intelligent 300+ Model Evaluation & Match Engine
 * Compares user task requirements against all 300+ models in the catalog
 * and automatically returns the #1 highest-ranked model for the job.
 */
function matchBestModelFrom300(query) {
  const q = String(query || "").toLowerCase().trim();
  const models = dynamicModelsCache || CURATED_MODELS;

  // 1. Feature Detection
  const hasCodeKeywords = /\b(function|def|const|class|import|return|git|sql|async|await|bug|refactor|compile|regex|algorithm|typescript|javascript|python|rust|c\+\+|java|html|css|php|ruby|swift|golang|api|endpoint|database)\b/i.test(q);
  const hasPython = /\b(python|pandas|numpy|django|fastapi|flask|pytorch|tensorflow|jupyter|sklearn|scikit)\b/i.test(q);
  const hasMathSTEM = /\b(prove|theorem|calculus|integral|derivative|matrix|eigen|differential|probability|combinatorics|discrete math|physics|chemistry|equation|math proof)\b/i.test(q);
  const hasDeepReasoning = /\b(step by step|chain of thought|first principles|deduction|deep analysis|philosophical|logical deduction|counterargument)\b/i.test(q);
  const hasVision = /\b(image|picture|screenshot|photo|diagram|chart|graph|look at this|ocr|read screen|what is on screen|inspect screen)\b/i.test(q);
  const hasLiveSearch = /\b(news|latest|today|current price|stock price|live weather|who won|score|recent events|citation|source)\b/i.test(q);
  const hasCreative = /\b(story|poem|novel|character|roleplay|dialogue|creative writing|essay|song lyrics|script|narrative)\b/i.test(q);
  const hasEnterprise = /\b(contract|audit|nda|compliance|balance sheet|quarterly earnings|business strategy|executive summary|rfp|sla)\b/i.test(q);
  const hasStructuredData = /\b(json|csv|yaml|xml|extract table|parse rows|schema validation|strict format)\b/i.test(q);
  const isShortGreeting = q.length < 30 && /^(hi|hello|hey|good morning|good evening|who are you|what can you do|how are you|thanks|thank you)\b/i.test(q);
  const isNonEnglish = /[^\x00-\x7F]/.test(query) && query.length > 5;

  // 2. Score every model in the 300+ catalog
  const scored = models.map((m) => {
    let score = 50; // Base score
    const id = (m.id || "").toLowerCase();
    const cat = (m.category || "").toLowerCase();

    // Domain affinity boosts
    if (hasCodeKeywords) {
      if (cat === "coding") score += 45;
      if (hasPython && id.includes("codestral")) score += 30;
      if (id.includes("claude-3.7-sonnet")) score += 35;
      if (id.includes("qwen-2.5-coder")) score += 30;
      if (id.includes("deepseek-coder")) score += 25;
    }

    if (hasMathSTEM) {
      if (cat === "reasoning") score += 45;
      if (id.includes("o3-mini")) score += 40;
      if (id.includes("o1")) score += 35;
      if (id.includes("math-72b")) score += 35;
      if (id.includes("deepseek-r1")) score += 30;
    }

    if (hasDeepReasoning) {
      if (cat === "reasoning") score += 45;
      if (id.includes("deepseek-r1")) score += 40;
      if (id.includes("claude-3.7-sonnet:thinking")) score += 35;
      if (id.includes("o1")) score += 30;
    }

    if (hasVision) {
      if (cat === "vision") score += 50;
      if (id.includes("gpt-4o")) score += 45;
      if (id.includes("qwen-2.5-vl")) score += 40;
    }

    if (hasLiveSearch) {
      if (cat === "research") score += 50;
      if (id.includes("sonar-reasoning")) score += 45;
      if (id.includes("sonar")) score += 40;
    }

    if (hasCreative) {
      if (cat === "creative") score += 45;
      if (id.includes("claude-3.5-sonnet")) score += 35;
      if (id.includes("hermes-3")) score += 30;
      if (id.includes("mythomax")) score += 30;
    }

    if (hasEnterprise) {
      if (cat === "enterprise") score += 45;
      if (id.includes("command-r-plus")) score += 40;
      if (id.includes("mistral-large")) score += 35;
    }

    if (hasStructuredData) {
      if (id.includes("gpt-4.1") || id.includes("gpt-4o-2024-08-06")) score += 45;
    }

    if (isNonEnglish) {
      if (cat === "multilingual" || id.includes("qwen-2.5-72b")) score += 45;
    }

    if (isShortGreeting) {
      if (cat === "fast") score += 40;
      if (id.includes("gpt-4o-mini")) score += 35;
    }

    // Benchmark tier quality bonus for flagship models
    if (m.featured) score += 15;

    return {
      ...m,
      score,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0] || CURATED_MODELS[0];

  return {
    model: best.id,
    modelLabel: best.name,
    category: best.category || "general",
    score: best.score,
    provider: best.provider,
    icon: best.icon || PROVIDER_ICONS[best.provider] || "🤖",
    why: `Auto-selected #1 model among 300+ AI models for optimal ${best.category} performance.`,
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
