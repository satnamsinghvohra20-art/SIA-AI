const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Thin wrapper around the OpenRouter unified chat completions endpoint.
 * OpenRouter speaks the OpenAI-compatible schema for every model it hosts,
 * so this one function is all we need to talk to 100+ models.
 */
async function callOpenRouter({ model, messages, max_tokens = 450, temperature = 0.7 }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing OPENROUTER_API_KEY. Add it to your .env file (see .env.example)."
    );
  }

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // Optional but recommended by OpenRouter for analytics/rate-limit tiers
      "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
      "X-Title": "Sia Orchestrator",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens,
      temperature,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenRouter returned no content: " + JSON.stringify(data));
  }
  return content;
}

/**
 * Same endpoint, but for tool-calling flows (the device-control agent
 * loop): accepts a `tools` array and returns the raw assistant message
 * (which may contain `tool_calls`) instead of just the text content, so
 * the caller can inspect and act on tool calls itself.
 */
async function callOpenRouterWithTools({ model, messages, tools, max_tokens = 700, temperature = 0.2 }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing OPENROUTER_API_KEY. Add it to your .env file (see .env.example)."
    );
  }

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
      "X-Title": "Sia Orchestrator",
    },
    body: JSON.stringify({
      model,
      messages,
      tools,
      max_tokens,
      temperature,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const message = data?.choices?.[0]?.message;
  if (!message) {
    throw new Error("OpenRouter returned no message: " + JSON.stringify(data));
  }
  return message; // { role, content, tool_calls? }
}

module.exports = { callOpenRouter, callOpenRouterWithTools };
