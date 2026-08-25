const system = require("./deviceControl/handlers/system");
const whatsapp = require("./deviceControl/handlers/whatsapp");
const uiControl = require("./deviceControl/handlers/uiControl");

/**
 * FAST-PATH DIRECT INTENT DISPATCHER (<50ms Execution)
 * -----------------------------------------------------
 * Bypasses the multi-second LLM tool-calling loop for clear, deterministic
 * instructions (e.g. opening apps, playing songs/videos, web searches, WhatsApp).
 * 
 * Supports:
 *  - Single-shot direct actions (<50ms)
 *  - Multi-intent compound chaining (e.g. "open youtube and play interstellar and mute")
 * 
 * Returns:
 *  - { matched: true, answer: string, result: object, steps: array }
 *  - { matched: false } -> passes through to LLM device agent / router
 */

const KNOWN_APPS = [
  "whatsapp", "youtube", "spotify", "flipkart", "amazon", "instagram",
  "gmail", "edge", "chrome", "notepad", "calc", "calculator", "netflix",
  "discord", "telegram", "reddit", "twitter", "x", "github", "maps",
  "google maps", "cricbuzz", "weather", "wikipedia", "vscode", "code"
];

function cleanCommand(text) {
  return (text || "")
    .toLowerCase()
    .trim()
    .replace(/^(sia|hey sia|hi sia|ok sia|jarvis|hey jarvis)[,\s:]*/i, "")
    .replace(/[.?!]+$/g, "")
    .trim();
}

async function executeSingleIntent(text) {
  if (!text) return null;

  // 1. "play <song/video> on youtube / spotify"
  const playMatch = text.match(/^(?:play|listen to)\s+(.+?)(?:\s+on\s+(youtube|spotify))?$/i);
  if (playMatch) {
    const query = playMatch[1].trim();
    const targetApp = (playMatch[2] || "youtube").toLowerCase();
    const res = await system.openApp({ app: targetApp, query });
    return {
      action: "open_app",
      params: { app: targetApp, query },
      summary: `Playing ${query} on ${targetApp === "spotify" ? "Spotify" : "YouTube"}`,
      result: res,
    };
  }

  // 2. "search for <query> on <engine/site>" or "search <query>" or "google <query>"
  const searchMatch = text.match(/^(?:search(?:\s+for)?|google|look up|find)\s+(.+?)(?:\s+(?:on|in)\s+(google|youtube|amazon|flipkart|wikipedia|reddit))?$/i);
  if (searchMatch && !text.startsWith("search web for news")) {
    const query = searchMatch[1].trim();
    const platform = (searchMatch[2] || "google").toLowerCase();
    let res;
    let actionName = "open_app";
    if (platform === "google") {
      res = await system.openUrl({ url: `https://www.google.com/search?q=${encodeURIComponent(query)}` });
      actionName = "open_url";
    } else {
      res = await system.openApp({ app: platform, query });
    }
    return {
      action: actionName,
      params: { query, platform },
      summary: `Searched for "${query}" on ${platform}`,
      result: res,
    };
  }

  // 3. "open <app> and write/send <message>" or "send whatsapp to <person> <message>"
  const waMatch = text.match(/^(?:send\s+whatsapp(?:\s+to)?|open\s+whatsapp\s+and\s+(?:send|write|type))\s+([a-zA-Z0-9\s+]+?)(?:\s+(?:message|msg|text|that)?\s*[:,-]?\s*(.+))?$/i);
  if (waMatch) {
    const to = waMatch[1].trim();
    const message = waMatch[2] ? waMatch[2].trim() : "Hello";
    const res = await whatsapp.sendWhatsappMessage({ to, message });
    return {
      action: "send_whatsapp_message",
      params: { to, message },
      summary: `WhatsApp message sent to ${to}`,
      result: res,
    };
  }

  // 4. "open / launch / switch to <app>"
  const openMatch = text.match(/^(?:open|launch|switch to|start|bring up|go to)\s+([a-zA-Z0-9.\s]+?)(?:\s+(?:and|with)\s+(?:search|query|play)\s+(.+))?$/i);
  if (openMatch) {
    const rawApp = openMatch[1].trim();
    const query = openMatch[2] ? openMatch[2].trim() : undefined;
    const isKnown = KNOWN_APPS.some(a => rawApp.includes(a)) || rawApp.includes(".com") || rawApp.includes(".org") || rawApp.includes(".in");
    
    if (isKnown) {
      const res = await system.openApp({ app: rawApp, query });
      const prettyApp = rawApp.charAt(0).toUpperCase() + rawApp.slice(1);
      const summary = res?.reused
        ? `Switched to active ${prettyApp}`
        : `Opened ${prettyApp}`;
      return {
        action: "open_app",
        params: { app: rawApp, query },
        summary,
        result: res,
      };
    }
  }

  // 5. System controls: "mute", "unmute", "take a screenshot"
  if (text === "mute" || text === "mute volume" || text === "mute sound") {
    const res = await system.setVolume({ mute: true });
    return {
      action: "set_volume",
      params: { mute: true },
      summary: "Muted volume",
      result: res,
    };
  }
  if (text === "unmute" || text === "unmute volume" || text === "unmute sound") {
    const res = await system.setVolume({ mute: false });
    return {
      action: "set_volume",
      params: { mute: false },
      summary: "Unmuted volume",
      result: res,
    };
  }
  if (text.includes("take a screenshot") || text === "screenshot") {
    const res = await system.takeScreenshot({});
    return {
      action: "take_screenshot",
      params: {},
      summary: "Captured screenshot",
      result: res,
    };
  }

  return null;
}

/**
 * Splits compound commands like:
 * "open youtube and play lo-fi and then mute volume"
 */
function splitCompoundClauses(text) {
  const parts = text.split(/\s+(?:and then|and also|then)\s+/i);
  if (parts.length > 1) return parts.map(p => p.trim()).filter(Boolean);

  // Split on " and " followed by common action verbs
  const verbRegex = /\s+and\s+(?=(?:open|play|search|send|launch|mute|unmute|take|switch|type)\b)/i;
  const subParts = text.split(verbRegex);
  if (subParts.length > 1) return subParts.map(p => p.trim()).filter(Boolean);

  return [text];
}

async function tryFastDispatch(rawText) {
  const text = cleanCommand(rawText);
  if (!text) return { matched: false };

  const clauses = splitCompoundClauses(text);

  // Single intent execution
  if (clauses.length === 1) {
    const single = await executeSingleIntent(clauses[0]);
    if (!single) return { matched: false };
    return {
      matched: true,
      answer: `${single.summary}, sir.`,
      result: single.result,
      steps: [{ action: single.action, params: single.params, result: single.result }],
      category: "device_control",
    };
  }

  // Compound multi-intent execution
  const executedSteps = [];
  const summaries = [];

  for (const clause of clauses) {
    const res = await executeSingleIntent(clause);
    if (res) {
      executedSteps.push({ action: res.action, params: res.params, result: res.result });
      summaries.push(res.summary);
    }
  }

  if (executedSteps.length === 0) {
    return { matched: false };
  }

  const combinedAnswer = summaries.length === 1
    ? `${summaries[0]}, sir.`
    : `${summaries.slice(0, -1).join(", ")} and ${summaries[summaries.length - 1]}, sir.`;

  return {
    matched: true,
    answer: combinedAnswer,
    result: executedSteps[executedSteps.length - 1].result,
    steps: executedSteps,
    category: "device_control",
  };
}

module.exports = { tryFastDispatch };
