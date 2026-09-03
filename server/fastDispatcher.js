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

  // 1. "open <app> and (place order for|order|buy|purchase|search|find|play) <item>"
  const openAndActionMatch = text.match(/^(?:open|launch|go to)\s+([a-zA-Z0-9.\s]+?)\s+and\s+(?:place\s+order\s+for|order|buy|purchase|shop\s+for|search(?:\s+for)?|find|look\s+up|play)\s+(.+)$/i);
  if (openAndActionMatch) {
    const platform = openAndActionMatch[1].trim().toLowerCase();
    const item = openAndActionMatch[2].trim();
    const res = await system.openApp({ app: platform, query: item });
    const prettyPlatform = platform.charAt(0).toUpperCase() + platform.slice(1);
    return {
      action: "open_app",
      params: { app: platform, query: item },
      summary: `Opened ${prettyPlatform} with ${item} ready on screen`,
      result: res,
    };
  }

  // 2. Direct Messaging (WhatsApp, Messages, Text):
  // "send whatsapp to Satnam hello", "send message to John saying I will be late", "whatsapp Mom how are you", "send a message to Alex that meeting is ready"
  const waMatch = text.match(/^(?:send\s+(?:a\s+)?(?:whatsapp|message|text|msg)(?:\s+to)?|(?:whatsapp|message|text))\s+([a-zA-Z0-9\s+]+?)(?:\s+(?:message|msg|saying|text|that)?\s*[:,-]?\s*(.+))?$/i);
  if (waMatch && !text.startsWith("send email")) {
    const to = waMatch[1].trim();
    const message = waMatch[2] ? waMatch[2].trim() : "Hello";
    const res = await whatsapp.sendWhatsappMessage({ to, message });
    return {
      action: "send_whatsapp_message",
      params: { to, message },
      summary: `Dispatched message to ${to}`,
      result: res,
    };
  }

  // 3. "play <song/video> on youtube / spotify" or "play <song>"
  const playMatch = text.match(/^(?:play|listen to)\s+(.+?)(?:\s+on\s+(youtube|spotify))?$/i);
  if (playMatch) {
    const query = playMatch[1].trim();
    const targetApp = (playMatch[2] || (query.toLowerCase().includes("song") || query.toLowerCase().includes("track") ? "spotify" : "youtube")).toLowerCase();
    const res = await system.openApp({ app: targetApp, query });
    return {
      action: "open_app",
      params: { app: targetApp, query },
      summary: `Playing ${query} on ${targetApp === "spotify" ? "Spotify" : "YouTube"}`,
      result: res,
    };
  }

  // 4. "order/buy/purchase/place order for <item> on flipkart/amazon" or "order/buy <item>"
  const buyMatch = text.match(/^(?:place\s+order\s+for|order|buy|purchase|shop\s+for)\s+(.+?)(?:\s+(?:on|from|in)\s+([a-zA-Z0-9\s]+))?$/i);
  if (buyMatch) {
    const item = buyMatch[1].trim();
    const platform = (buyMatch[2] || "flipkart").toLowerCase().trim();
    const res = await system.openApp({ app: platform, query: item });
    const prettyPlatform = platform.charAt(0).toUpperCase() + platform.slice(1);
    return {
      action: "open_app",
      params: { app: platform, query: item },
      summary: `Opened ${prettyPlatform} with ${item} ready on screen`,
      result: res,
    };
  }

  // 5. "search for <query> on <engine/site>" or "search <query>" or "google <query>"
  const searchMatch = text.match(/^(?:search(?:\s+for)?|google|look up|find)\s+(.+?)(?:\s+(?:on|in)\s+([a-zA-Z0-9\s]+))?$/i);
  if (searchMatch && !text.startsWith("search web for news")) {
    const query = searchMatch[1].trim();
    const platform = (searchMatch[2] || "google").toLowerCase().trim();
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

  // 6. Universal App & Website Launcher: "open <app>", "launch <app>", "start <app>", "go to <site>", "switch to <app>"
  const openMatch = text.match(/^(?:open|launch|switch to|start|bring up|go to)\s+([a-zA-Z0-9.\s_-]+?)(?:\s+(?:and|with)\s+(?:search|query|play|order|buy)\s+(.+))?$/i);
  if (openMatch) {
    const rawApp = openMatch[1].trim();
    const query = openMatch[2] ? openMatch[2].trim() : undefined;
    
    const res = await system.openApp({ app: rawApp, query });
    const prettyApp = rawApp.charAt(0).toUpperCase() + rawApp.slice(1);
    const summary = res?.reused
      ? `Switched to active ${prettyApp}`
      : query
        ? `Opened ${prettyApp} with ${query}`
        : `Opened ${prettyApp}`;
    return {
      action: "open_app",
      params: { app: rawApp, query },
      summary,
      result: res,
    };
  }

  // 7. Direct Shell Command Execution: "run command <cmd>", "execute <cmd>", "run shell <cmd>"
  const cmdMatch = text.match(/^(?:run\s+command|run\s+terminal|execute\s+command|execute|exec|run\s+shell)\s+(.+)$/i);
  if (cmdMatch) {
    const scripts = require("./deviceControl/handlers/scripts");
    const cmd = cmdMatch[1].trim();
    const res = await scripts.runCommand({ command: cmd });
    const outputPreview = res.stdout ? res.stdout.slice(0, 150) : (res.stderr ? res.stderr.slice(0, 150) : "Done");
    return {
      action: "run_command",
      params: { command: cmd },
      summary: `Executed command: ${cmd}. Output: ${outputPreview}`,
      result: res,
    };
  }

  // 8. Direct Phone Call / Dialer: "call <number/person>" or "dial <number>"
  const callMatch = text.match(/^(?:call|dial)\s+([a-zA-Z0-9+\s]+)$/i);
  if (callMatch && !text.includes("whatsapp") && !text.includes("api")) {
    const calls = require("./deviceControl/handlers/calls");
    const target = callMatch[1].trim();
    const res = await calls.placeCall({ to: target });
    return {
      action: "place_call",
      params: { to: target },
      summary: `Dialing ${target}`,
      result: res,
    };
  }

  // 9. Volume & Audio Controls
  if (text === "mute" || text === "mute volume" || text === "mute sound") {
    const res = await system.setVolume({ mute: true });
    return { action: "set_volume", params: { mute: true }, summary: "Muted volume", result: res };
  }
  if (text === "unmute" || text === "unmute volume" || text === "unmute sound") {
    const res = await system.setVolume({ mute: false });
    return { action: "set_volume", params: { mute: false }, summary: "Unmuted volume", result: res };
  }
  const volUpMatch = text.match(/^(?:volume up|increase volume|raise volume)(?:\s+by\s+(\d+))?$/i);
  if (volUpMatch) {
    const res = await system.setVolume({ percent: 75 });
    return { action: "set_volume", params: { percent: 75 }, summary: "Increased volume to 75%", result: res };
  }
  const volDownMatch = text.match(/^(?:volume down|decrease volume|lower volume)(?:\s+by\s+(\d+))?$/i);
  if (volDownMatch) {
    const res = await system.setVolume({ percent: 30 });
    return { action: "set_volume", params: { percent: 30 }, summary: "Decreased volume to 30%", result: res };
  }

  // 10. Screen & Screenshots
  if (text.includes("take a screenshot") || text === "take screenshot" || text === "capture screen" || text === "screenshot") {
    const res = await system.takeScreenshot({});
    return { action: "take_screenshot", params: {}, summary: "Captured screenshot", result: res };
  }

  // 11. System Info & Diagnostics
  if (text === "system diagnostic" || text === "system info" || text === "system status" || text === "hardware diagnostic") {
    const res = { memory: process.memoryUsage(), uptime: process.uptime(), platform: process.platform, arch: process.arch };
    const memMB = Math.round(res.memory.rss / (1024 * 1024));
    return { action: "system_info", params: {}, summary: `System Status: Healthy, Memory Load: ${memMB}MB, Uptime: ${Math.round(res.uptime)}s`, result: res };
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

  // 1. Try single intent on full text first (prevents "open youtube and play song" from splitting into 2 open actions)
  const directMatch = await executeSingleIntent(text);
  if (directMatch) {
    return {
      matched: true,
      answer: `${directMatch.summary}, sir.`,
      result: directMatch.result,
      steps: [{ action: directMatch.action, params: directMatch.params, result: directMatch.result }],
      category: "device_control",
    };
  }

  // 2. Try compound multi-intent splitting (e.g. "open youtube and play lo-fi and then mute volume")
  const clauses = splitCompoundClauses(text);
  if (clauses.length <= 1) {
    return { matched: false };
  }

  const executedSteps = [];
  const summaries = [];
  const openedApps = new Set();

  for (const clause of clauses) {
    const res = await executeSingleIntent(clause);
    if (res) {
      // Prevent launching the exact same app twice in one compound command
      if (res.action === "open_app" && res.params?.app) {
        const appKey = res.params.app.toLowerCase();
        if (openedApps.has(appKey) && !res.params.query) {
          continue;
        }
        openedApps.add(appKey);
      }
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
