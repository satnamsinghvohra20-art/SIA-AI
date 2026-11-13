const { callOpenRouter, isFreeTierAccount } = require("./openrouterClient");
const { getModelForCategory } = require("./modelRegistry");

/**
 * CLASSIFIER (Instant 0ms Heuristic + Ultra-Fast LLM Fallback)
 * -------------------------------------------------------------
 * Decides which specialized AI model best suits the user's task.
 */

const CATEGORY_KEYWORDS = {
  // Device & Universal Web/App Control
  device_control: [
    "open app", "close app", "open edge", "open chrome", "open browser",
    "open youtube", "open spotify", "open whatsapp", "open instagram", "open notepad",
    "open calc", "open calculator", "open website", "open url", "search on edge",
    "search in edge", "search in google", "search web", "browse", "browse to",
    "open amazon", "open flipkart", "open ebay", "open netflix", "open twitch",
    "open reddit", "open twitter", "open linkedin", "open github", "open stackoverflow",
    "open maps", "open google maps", "open wikipedia", "open news", "open gmail",
    "open mail", "open email", "open outlook", "open cricbuzz", "open weather",
    "open telegram", "open discord", "search youtube", "search spotify", "search amazon",
    "search google", "search wikipedia", "search maps", "search reddit", "search github",
    "play on youtube", "play on spotify", "play song", "play music", "play video", "play track",
    "turn on", "turn off", "shut down", "shutdown", "restart my", "set volume",
    "take a screenshot", "send a whatsapp", "send whatsapp", "message on instagram",
    "read message", "read messages", "view message", "view messages", "check message", "check messages",
    "read whatsapp", "view whatsapp", "check whatsapp", "check my whatsapp", "read my messages",
    "read chat", "view chat", "what messages", "read screen", "read the screen", "view screen",
    "what is on my screen", "what's on my screen",
    "call my", "place a call", "run the script", "delete the file", "control my device",
    "control my pc", "control my computer", "control my phone", "type text", "click on",
    "mute volume", "unmute volume", "type message", "press enter",
  ],

  // Python & Backend Logic
  coding_python: [
    "python", "pandas", "numpy", "django", "fastapi", "flask", "pytorch",
    "tensorflow", "asyncio", "pip install", "jupyter", "scikit-learn",
  ],

  // Rapid Syntax, Snippets & Code Gen
  coding_fast: [
    "snippet", "quick code", "write a function", "regex", "convert code",
    "format code", "css style", "html template", "bash script", "powershell script",
  ],

  // Heavy Coding & Architecture
  coding: [
    "code", "refactor", "debug", "stack trace", "algorithm", "compiler",
    "typescript", "javascript", "react", "vue", "nextjs", "node.js", "database design",
    "rest api", "graphql", "microservice", "class architecture", "git conflict",
  ],

  // Deep Open Chain-of-Thought
  deep_thinking: [
    "deep think", "step by step", "chain of thought", "first principles",
    "thorough deduction", "deep analysis", "philosophical proof",
  ],

  // Advanced Math & STEM Reasoning
  reasoning: [
    "prove", "theorem", "math proof", "calculus", "linear algebra", "discrete math",
    "combinatorics", "probability", "derive equation", "formal logic", "logic puzzle",
  ],

  // Rapid Logic & Quick Math
  fast_reasoning: [
    "riddle", "brain teaser", "quick math", "mental calculation", "logic test",
  ],

  // Real-Time Web Research & Deep Citations
  research: [
    "live search", "verify source", "citation", "fact check", "research study",
    "peer-reviewed", "find sources", "deep research",
  ],

  // Instant News & Breaking Facts
  research_fast: [
    "latest news", "current price", "stock price", "today's news", "who won",
    "weather today", "what happened today", "live score", "recent news",
  ],

  // Deep Multimodal Vision & Diagrams
  vision: [
    "analyze image", "diagram", "flowchart", "system architecture diagram",
    "chart analysis", "infographic", "visual graph", "ui design review",
  ],

  // Instant OCR & Screenshots
  vision_fast: [
    "ocr", "screenshot", "read image", "extract text from image", "photo text",
    "receipt scan",
  ],

  // Massive 2M Context Document Analysis
  long_context: [
    "entire document", "whole book", "full codebase", "100 pages", "large pdf",
    "contract analysis", "summarize entire repo",
  ],

  // Structured Data, Tables & JSON
  data: [
    "json schema", "csv data", "xml parsing", "yaml", "sql query", "extract table",
    "tabular data", "database migration", "excel formulas", "parse spreadsheet",
  ],

  // Cybersecurity & Auditing
  cybersecurity: [
    "security audit", "vulnerability", "cve", "penetration test", "sql injection",
    "xss attack", "csrf", "jwt exploit", "auth bypass", "secure coding", "encryption cipher",
  ],

  // Multilingual & Translation
  multilingual: [
    "translate to", "translation", "in spanish", "in french", "in german",
    "in hindi", "in japanese", "in chinese", "in arabic", "multilingual",
  ],

  // Business Strategy & Financial Analysis
  finance_business: [
    "financial model", "dcf valuation", "roi calculation", "balance sheet",
    "investor pitch", "business strategy", "market sizing", "tam sam som",
    "p&l analysis", "venture capital",
  ],

  // Science & Calculations
  math_science: [
    "physics", "chemistry", "quantum", "thermodynamics", "differential equation",
    "organic chemistry", "biochemistry", "kinetics", "relativity",
  ],

  // Witty & Unfiltered Intelligence
  witty_unfiltered: [
    "roast", "tell a joke", "sarcastic", "humorous take", "funny story",
    "witty response", "grok",
  ],

  // Master Creative Writing & Prose
  creative: [
    "write a novel", "story", "screenplay", "narrative", "poetry", "character dialogue",
    "short story", "fiction", "worldbuilding",
  ],

  // Fast Creative Copy & Headlines
  creative_fast: [
    "slogan", "tagline", "headline", "ad copy", "social media caption",
    "brainstorm names", "marketing hook",
  ],

  // Open Source Flagship
  open_source: [
    "llama 3", "open source model", "open weights", "huggingface", "local llm",
  ],

  // Open Source 405B Giant
  open_source_giant: [
    "llama 405b", "largest open model", "massive open weights",
  ],

  // Ultra-Fast Chat (<100ms)
  ultra_fast_chat: [
    "hi", "hello", "hey", "yo", "good morning", "good evening", "howdy",
    "thanks", "thank you", "bye", "goodbye", "ping",
  ],

  // Fast General Everyday
  fast_general: [
    "quick question", "explain simply", "what is", "define", "how does",
    "give me a summary", "pros and cons",
  ],

  // Omni Flagship Multimodal
  flagship_omni: [
    "gpt-4o", "comprehensive analysis", "multidisciplinary overview",
  ],

  // GPT Fast Everyday
  gpt_fast: [
    "proofread", "fix grammar", "rephrase", "bullet points", "draft email",
  ],
};

const DEVICE_CONTROL_PATTERNS = [
  /\b(open|launch|start|close|exit|quit|kill|play|pause|stop|resume|switch\s+to)\s+([a-z0-9\.\s_-]+)/i,
  /\b(order|buy|purchase|shop\s+for|add\s+to\s+cart|checkout)\b/i,
  /\b(run\s+command|run\s+terminal|execute\s+command|execute|exec|run\s+shell|run\s+script|powershell|cmd)\b/i,
  /\b(run|check)\s+(git\s+status|git\s+log|npm\s+test|ipconfig|my\s+ip|disk\s+space|battery|system\s+info|system\s+status|running\s+apps|processes)\b/i,
  /\b(git\s+status|ipconfig|ping\s+[a-z0-9.\-]+)\b/i,
  /\b(create|make|write|save|read|cat|delete|remove|move|rename|list|show)\s+(a\s+)?(file|folder|directory|dir|files|clipboard)\b/i,
  /\b(write|save)\s+.+\s+(to|in|into)\s+(file\s+)?[a-z0-9_.\-\\/:~]+/i,
  /\b(send|draft|text|message|dm|tell)\s+(a\s+)?(whatsapp|instagram|email|message|text|to)\b/i,
  /\b(send|tell)\s+.+\s+on\s+(whatsapp|instagram)\b/i,
  /\b(call|dial|phone|ring)\s+([a-z0-9+\s]+)/i,
  /\b(read|view|check|inspect|show|tell\s+me)\s+(my\s+)?(screen|messages|chats|whatsapp|notifications|inbox|window|clipboard|running\s+apps|open\s+windows)\b/i,
  /\b(what\s+is|what's)\s+(on\s+my|on\s+the|in\s+my)\s+(screen|clipboard)\b/i,
  /\b(take|capture)\s+(a\s+)?(screenshot|screen\s+capture)\b/i,
  /\b(set\s+volume|turn\s+volume|volume\s+to|volume\s+up|volume\s+down|volume\s+\d+|mute|unmute|increase\s+volume|decrease\s+volume)\b/i,
  /\b(set\s+brightness|brightness\s+to|brightness\s+\d+|dim\s+screen|brighten\s+screen|max\s+brightness)\b/i,
  /\b(maximize|minimize|restore)\s+(this\s+|active\s+|all\s+)?(window|windows)\b/i,
  /\b(show\s+desktop|go\s+to\s+desktop|lock\s+screen|lock\s+pc|lock\s+computer|lock\s+workstation)\b/i,
  /\b(shutdown|shut\s+down|restart\s+my|restart\s+computer|sleep\s+pc)\b/i,
  /\b(type|press|click|scroll|tap|swipe|copy)\s+([a-z0-9\.\s_+'"-]+)/i,
  /\bscroll\s+(up|down)\b/i,
  /\b(search|find|google|browse|look\s+up)\s+(on|in|for)\s+(edge|chrome|google|youtube|spotify|amazon|flipkart|reddit|wikipedia|web|maps|internet)\b/i,
  /\b(search\s+web|search\s+the\s+web|browse\s+to)\b/i,
  /\b(not\s+open|not\s+opened|didn't\s+open|did\s+not\s+open|haven't\s+opened|have\s+not\s+opened|can't\s+see|cannot\s+see|open\s+it|open\s+again|do\s+it\s+again|try\s+again)\b/i,
  /\b(whatsapp|youtube|instagram|spotify|flipkart|amazon|netflix)\s+(is\s+not|not|again|please|now)\b/i,
];

function heuristicClassify(text) {
  const lower = text.toLowerCase().trim();

  // 1. Instant Regex Detection for Device Control
  for (const pattern of DEVICE_CONTROL_PATTERNS) {
    if (pattern.test(lower)) {
      return "device_control";
    }
  }

  let bestCategory = null;
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.filter((kw) => lower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  // Require at least one matching signal
  return bestScore > 0 ? bestCategory : null;
}

async function llmClassify(text) {
  const categories = Object.keys(require("./modelRegistry").MODEL_REGISTRY).filter(
    (c) => c !== "default" && c !== "super_blend"
  );

  const systemPrompt = `You are an ultra-fast task classifier. Classify the user's prompt into exactly one of these categories: ${categories.join(
    ", "
  )}. Reply with ONLY the category name and nothing else.`;

  const fastClassifierModel = getModelForCategory("ultra_fast_chat", {
    freeTier: isFreeTierAccount(),
  }).model;

  try {
    const result = await callOpenRouter({
      model: fastClassifierModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
      max_tokens: 15,
      temperature: 0.1,
    });
    const guess = result.trim().toLowerCase().replace(/[^a-z_]/g, "");
    return categories.includes(guess) ? guess : "default";
  } catch (err) {
    console.error("Classifier LLM fallback failed:", err.message);
    return "default";
  }
}

async function classify(text) {
  const heuristicGuess = heuristicClassify(text);
  if (heuristicGuess) {
    return { category: heuristicGuess, method: "heuristic" };
  }

  // Only pay the latency of an LLM classification call if the prompt hints at
  // an implicit device/system/app action that regex didn't catch.
  const maybeDeviceAction = /\b(app|screen|window|tab|browser|phone|mobile|pc|computer|laptop|desktop|file|folder|whatsapp|instagram|youtube|spotify|volume|battery|brightness|wifi|bluetooth|notify|notification)\b/i.test(text);
  if (!maybeDeviceAction) {
    return { category: "default", method: "instant_zero_ms" };
  }

  const llmGuess = await llmClassify(text);
  return { category: llmGuess, method: "llm" };
}

module.exports = { classify };
