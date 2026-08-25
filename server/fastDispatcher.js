const system = require("./deviceControl/handlers/system");
const whatsapp = require("./deviceControl/handlers/whatsapp");
const uiControl = require("./deviceControl/handlers/uiControl");

/**
 * FAST-PATH DIRECT INTENT DISPATCHER (<50ms Execution)
 * -----------------------------------------------------
 * Bypasses the multi-second LLM tool-calling loop for clear, deterministic
 * instructions (e.g. opening apps, playing songs/videos, web searches, WhatsApp).
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

async function tryFastDispatch(rawText) {
  const text = cleanCommand(rawText);
  if (!text) return { matched: false };

  // 1. "play <song/video> on youtube / spotify"
  const playMatch = text.match(/^(?:play|listen to)\s+(.+?)(?:\s+on\s+(youtube|spotify))?$/i);
  if (playMatch) {
    const query = playMatch[1].trim();
    const targetApp = (playMatch[2] || "youtube").toLowerCase();
    const res = await system.openApp({ app: targetApp, query });
    return {
      matched: true,
      answer: `Playing ${query} on ${targetApp === "spotify" ? "Spotify" : "YouTube"}, sir.`,
      result: res,
      steps: [{ action: "open_app", params: { app: targetApp, query }, result: res }],
      category: "device_control",
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
      matched: true,
      answer: `Searched for "${query}" on ${platform}, sir.`,
      result: res,
      steps: [{ action: actionName, params: { query, platform }, result: res }],
      category: "device_control",
    };
  }

  // 3. "open <app> and write/send <message>" or "send whatsapp to <person> <message>"
  const waMatch = text.match(/^(?:send\s+whatsapp(?:\s+to)?|open\s+whatsapp\s+and\s+(?:send|write|type))\s+([a-zA-Z0-9\s+]+?)(?:\s+(?:message|msg|text|that)?\s*[:,-]?\s*(.+))?$/i);
  if (waMatch) {
    const to = waMatch[1].trim();
    const message = waMatch[2] ? waMatch[2].trim() : "Hello";
    const res = await whatsapp.sendWhatsappMessage({ to, message });
    return {
      matched: true,
      answer: `WhatsApp message sent to ${to}, sir.`,
      result: res,
      steps: [{ action: "send_whatsapp_message", params: { to, message }, result: res }],
      category: "device_control",
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
      const answer = res?.reused
        ? `Switched to your active ${prettyApp} window, sir.`
        : `Opened ${prettyApp}, sir.`;
      return {
        matched: true,
        answer,
        result: res,
        steps: [{ action: "open_app", params: { app: rawApp, query }, result: res }],
        category: "device_control",
      };
    }
  }

  // 5. System controls: "mute", "unmute", "take a screenshot"
  if (text === "mute" || text === "mute volume" || text === "mute sound") {
    const res = await system.setVolume({ mute: true });
    return {
      matched: true,
      answer: "Audio muted, sir.",
      result: res,
      steps: [{ action: "set_volume", params: { mute: true }, result: res }],
      category: "device_control",
    };
  }
  if (text === "unmute" || text === "unmute volume" || text === "unmute sound") {
    const res = await system.setVolume({ mute: false });
    return {
      matched: true,
      answer: "Audio unmuted, sir.",
      result: res,
      steps: [{ action: "set_volume", params: { mute: false }, result: res }],
      category: "device_control",
    };
  }
  if (text.includes("take a screenshot") || text === "screenshot") {
    const res = await system.takeScreenshot({});
    return {
      matched: true,
      answer: "Screenshot captured successfully, sir.",
      result: res,
      steps: [{ action: "take_screenshot", params: {}, result: res }],
      category: "device_control",
    };
  }

  // Not a direct deterministic command -> pass to LLM
  return { matched: false };
}

module.exports = { tryFastDispatch };
