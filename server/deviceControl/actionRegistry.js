const system = require("./handlers/system");
const files = require("./handlers/files");
const scripts = require("./handlers/scripts");
const whatsapp = require("./handlers/whatsapp");
const instagram = require("./handlers/instagram");
const calls = require("./handlers/calls");
const ui = require("./handlers/uiControl");
const mobile = require("./handlers/mobile");
<<<<<<< HEAD
const screenReader = require("./handlers/screenReader");
=======
>>>>>>> 9422c3abfb40b468243a8ad777f3982b1242aa16

/**
 * ACTION REGISTRY
 * ---------------
 * Every action Sia's device-control agent can take, in one place.
 * `risk: "risky"` actions ALWAYS pause for human confirmation before
 * running — see executor.js — regardless of what the model or the
 * instruction says. That's enforced server-side, not by prompting, so it
 * can't be talked around by phrasing the request differently.
 *
 * `params` is a JSON-schema-ish description passed straight to the model
 * as an OpenAI-style tool definition (OpenRouter speaks this format for
 * tool-calling-capable models).
 */
const ACTIONS = {
  open_app: {
<<<<<<< HEAD
    description:
      "Open an application or web service on this machine (e.g. edge, notepad, calc, spotify, whatsapp, instagram, youtube, code). " +
      "Can also directly search/play on the platform if 'query' is provided (e.g. app: 'youtube', query: 'AC/DC' or app: 'spotify', query: 'coldplay'). " +
      "If a Windows app is not installed or not logged in, it automatically opens the web version in Microsoft Edge.",
    risk: "safe",
    params: {
      type: "object",
      properties: {
        app: { type: "string", description: "Friendly app name, web service, or domain" },
        query: { type: "string", description: "Optional search query, video, song, topic, or message to look up within the app" },
      },
=======
    description: "Open an application on this machine (e.g. chrome, calculator, notepad).",
    risk: "safe",
    params: {
      type: "object",
      properties: { app: { type: "string", description: "Friendly app name" } },
>>>>>>> 9422c3abfb40b468243a8ad777f3982b1242aa16
      required: ["app"],
    },
    handler: system.openApp,
  },
<<<<<<< HEAD
  open_url: {
    description:
      "Open a website URL in the default browser (Microsoft Edge) on this computer. " +
      "Use this for any web task, online service, video, or website (e.g. 'https://www.youtube.com', 'https://web.whatsapp.com', 'https://www.instagram.com', 'https://open.spotify.com').",
    risk: "safe",
    params: {
      type: "object",
      properties: {
        url: { type: "string", description: "The full URL or web address to open" },
        browser: { type: "string", description: "Browser to use (default: 'edge')" },
      },
      required: ["url"],
    },
    handler: system.openUrl,
  },
  search_web: {
    description:
      "Search the web for a query using Microsoft Edge on this computer.",
    risk: "safe",
    params: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search keywords or question" },
        engine: { type: "string", description: "Search engine ('google' or 'bing', default 'google')" },
      },
      required: ["query"],
    },
    handler: system.searchWeb,
  },
=======
>>>>>>> 9422c3abfb40b468243a8ad777f3982b1242aa16
  close_app: {
    description: "Close/quit a running application.",
    risk: "safe",
    params: {
      type: "object",
      properties: { app: { type: "string" } },
      required: ["app"],
    },
    handler: system.closeApp,
  },
  set_volume: {
    description: "Set system output volume, 0-100.",
    risk: "safe",
    params: {
      type: "object",
      properties: { level: { type: "number", description: "0-100" } },
      required: ["level"],
    },
    handler: system.setVolume,
  },
  take_screenshot: {
    description: "Capture a screenshot of the current screen and save it.",
    risk: "safe",
    params: { type: "object", properties: {} },
    handler: system.takeScreenshot,
  },
  get_system_info: {
    description: "Read basic system stats (platform, uptime, memory, CPU count).",
    risk: "safe",
    params: { type: "object", properties: {} },
    handler: system.getSystemInfo,
  },
  system_power: {
    description: "Shut down, restart, or sleep this machine.",
    risk: "risky",
    params: {
      type: "object",
      properties: { action: { type: "string", enum: ["shutdown", "restart", "sleep"] } },
      required: ["action"],
    },
    handler: system.systemPower,
  },

  list_files: {
    description: "List files/folders inside Sia's sandboxed device-files folder.",
    risk: "safe",
    params: {
      type: "object",
      properties: { dir: { type: "string", description: "Relative path, default '.'" } },
    },
    handler: files.listDir,
  },
  read_file: {
    description: "Read a text file from Sia's sandboxed device-files folder.",
    risk: "safe",
    params: {
      type: "object",
      properties: { file: { type: "string" } },
      required: ["file"],
    },
    handler: files.readFile,
  },
  write_file: {
    description: "Create or overwrite a text file in Sia's sandboxed device-files folder.",
    risk: "risky",
    params: {
      type: "object",
      properties: { file: { type: "string" }, content: { type: "string" } },
      required: ["file", "content"],
    },
    handler: files.writeFile,
  },
  move_file: {
    description: "Move/rename a file within Sia's sandboxed device-files folder.",
    risk: "risky",
    params: {
      type: "object",
      properties: { from: { type: "string" }, to: { type: "string" } },
      required: ["from", "to"],
    },
    handler: files.moveFile,
  },
  delete_file: {
    description: "Delete a file or folder within Sia's sandboxed device-files folder.",
    risk: "risky",
    params: {
      type: "object",
      properties: { file: { type: "string" } },
      required: ["file"],
    },
    handler: files.deleteFile,
  },

  run_script: {
    description:
      "Run a pre-approved, whitelisted script by name from server/deviceControl/scripts/. " +
      "Cannot run arbitrary shell commands — only scripts that already exist on disk.",
    risk: "risky",
    params: {
      type: "object",
      properties: {
        name: { type: "string", description: "Script filename without extension" },
        args: { type: "array", items: { type: "string" } },
      },
      required: ["name"],
    },
    handler: scripts.runScript,
  },

  send_whatsapp_message: {
<<<<<<< HEAD
    description:
      "Send or draft a WhatsApp message to a contact name or phone number on WhatsApp Web (Microsoft Edge) or paired phone.",
    risk: "safe",
    params: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient name or phone number with country code, e.g. 'Mom', 'Alex', or '+919876543210'" },
        message: { type: "string", description: "The message text to send or draft" },
      },
      required: ["message"],
    },
    handler: whatsapp.sendWhatsappMessage,
  },
  read_whatsapp_messages: {
    description:
      "Read recent WhatsApp chat messages, unread messages, conversation history, and sender names on WhatsApp Web (Microsoft Edge) or WhatsApp Desktop.",
    risk: "safe",
    params: {
      type: "object",
      properties: {
        question: { type: "string", description: "Optional specific question or contact filter, e.g. 'Read last message from Satnam'" },
      },
    },
    handler: whatsapp.readWhatsappMessages,
  },
  read_screen_messages: {
    description:
      "Read and extract recent chat messages, sender names, incoming notifications, or conversation history from any open app on this computer (WhatsApp, Instagram, Microsoft Edge, Discord, Telegram).",
    risk: "safe",
    params: {
      type: "object",
      properties: {
        targetApp: { type: "string", description: "Optional app to inspect (e.g. 'whatsapp', 'edge', 'instagram')" },
        question: { type: "string", description: "Specific question or what messages to look for" },
      },
    },
    handler: screenReader.readScreenMessages,
  },
  read_screen_text: {
    description:
      "Inspect and read all visible text, notifications, window titles, documents, error prompts, or websites currently displayed on this computer's screen.",
    risk: "safe",
    params: {
      type: "object",
      properties: {
        question: { type: "string", description: "What to read, summarize, or extract from the screen" },
      },
    },
    handler: screenReader.readScreenText,
  },
  send_instagram_message: {
    description:
      "Send an Instagram DM to a username — free, drives the real Instagram app on your paired phone. " +
      "Best-effort: Instagram's UI can change and break this; you'll get a clear error if a step fails. " +
      "Requires the Android companion app to be connected.",
=======
    description: "Send a WhatsApp message via the configured Twilio WhatsApp sender.",
>>>>>>> 9422c3abfb40b468243a8ad777f3982b1242aa16
    risk: "risky",
    params: {
      type: "object",
      properties: {
<<<<<<< HEAD
        username: { type: "string", description: "Instagram username to message" },
        message: { type: "string" },
      },
      required: ["username", "message"],
=======
        to: { type: "string", description: "Recipient phone number, e.g. +919876543210" },
        message: { type: "string" },
      },
      required: ["to", "message"],
    },
    handler: whatsapp.sendWhatsappMessage,
  },
  send_instagram_message: {
    description: "Send an Instagram DM via the Meta Graph API (requires a Business/Creator account).",
    risk: "risky",
    params: {
      type: "object",
      properties: {
        recipientId: { type: "string", description: "Instagram-scoped recipient user id" },
        message: { type: "string" },
      },
      required: ["recipientId", "message"],
>>>>>>> 9422c3abfb40b468243a8ad777f3982b1242aa16
    },
    handler: instagram.sendInstagramMessage,
  },
  // --- Desktop UI control: works on ANY app, not just ones with an API ---
  ui_click: {
    description: "Click (or double-click) at a screen coordinate on this computer, in any app.",
    risk: "risky",
    params: {
      type: "object",
      properties: {
        x: { type: "number" },
        y: { type: "number" },
        double: { type: "boolean", description: "Double-click instead of single-click" },
      },
      required: ["x", "y"],
    },
    handler: ui.click,
  },
  ui_type: {
    description: "Type text into whatever field/app currently has focus on this computer.",
    risk: "risky",
    params: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    },
    handler: ui.typeText,
  },
  ui_press_key: {
    description: "Press a key or key combo on this computer, e.g. 'enter', 'escape', 'cmd+c', 'ctrl+v'.",
    risk: "risky",
    params: {
      type: "object",
      properties: { key: { type: "string" } },
      required: ["key"],
    },
    handler: ui.pressKey,
  },
  ui_scroll: {
    description: "Scroll the focused window up or down on this computer.",
    risk: "safe",
    params: {
      type: "object",
      properties: {
        direction: { type: "string", enum: ["up", "down"] },
        amount: { type: "number", description: "Scroll 'clicks', default 3" },
      },
      required: ["direction"],
    },
    handler: ui.scroll,
  },
  ui_read_screen: {
    description: "Take a screenshot of this computer's current screen so the next click/type can be decided.",
    risk: "safe",
    params: { type: "object", properties: {} },
    handler: ui.readScreen,
  },

  // --- Mobile control: forwarded to the paired Android companion app ---
  mobile_tap: {
    description: "Tap a point on the connected Android phone's screen, in any app.",
    risk: "risky",
    params: {
      type: "object",
      properties: { x: { type: "number" }, y: { type: "number" } },
      required: ["x", "y"],
    },
    handler: mobile.tap,
  },
  mobile_swipe: {
    description: "Swipe on the connected Android phone's screen from one point to another.",
    risk: "risky",
    params: {
      type: "object",
      properties: {
        x1: { type: "number" }, y1: { type: "number" },
        x2: { type: "number" }, y2: { type: "number" },
        durationMs: { type: "number", description: "default 300" },
      },
      required: ["x1", "y1", "x2", "y2"],
    },
    handler: mobile.swipe,
  },
  mobile_type: {
    description: "Type text into whatever field currently has focus on the connected Android phone.",
    risk: "risky",
    params: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    },
    handler: mobile.typeText,
  },
  mobile_open_app: {
    description: "Open an app on the connected Android phone by name (e.g. 'WhatsApp', 'Instagram', 'Camera').",
    risk: "safe",
    params: {
      type: "object",
      properties: { app: { type: "string" } },
      required: ["app"],
    },
    handler: mobile.openApp,
  },
  mobile_press_key: {
    description: "Press a system key on the connected Android phone: 'back', 'home', or 'recents'.",
    risk: "safe",
    params: {
      type: "object",
      properties: { key: { type: "string", enum: ["back", "home", "recents"] } },
      required: ["key"],
    },
    handler: mobile.pressKey,
  },
  mobile_read_screen: {
    description: "Read the labels/buttons/text currently visible on the connected Android phone's screen.",
    risk: "safe",
    params: { type: "object", properties: {} },
    handler: mobile.readScreen,
  },
  mobile_notify: {
    description: "Speak a short message out loud on the connected Android phone via its built-in text-to-speech.",
    risk: "safe",
    params: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    },
    handler: mobile.notify,
  },
<<<<<<< HEAD
  mobile_open_url: {
    description:
      "Open a URL or app deep link on the connected Android phone (e.g. a wa.me link, tel: number, " +
      "https://instagram.com/<user>/, or any other app's own link scheme). Prefer this over multiple " +
      "taps when a target app supports a direct link — fewer steps, fewer things that can go wrong.",
    risk: "safe",
    params: {
      type: "object",
      properties: { url: { type: "string" } },
      required: ["url"],
    },
    handler: mobile.openUrl,
  },

  place_call: {
    description:
      "Place an outbound phone call — free, opens the dialer on your paired phone and taps Call. " +
      "Can only dial, can't speak a message into the call. Requires the Android companion app to be connected.",
=======

  place_call: {
    description: "Place an outbound phone call via Twilio that speaks a message aloud.",
>>>>>>> 9422c3abfb40b468243a8ad777f3982b1242aa16
    risk: "risky",
    params: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient phone number, e.g. +919876543210" },
<<<<<<< HEAD
      },
      required: ["to"],
=======
        message: { type: "string" },
      },
      required: ["to", "message"],
>>>>>>> 9422c3abfb40b468243a8ad777f3982b1242aa16
    },
    handler: calls.placeCall,
  },
};

function toToolDefinitions() {
  return Object.entries(ACTIONS).map(([name, def]) => ({
    type: "function",
    function: {
      name,
      description: def.description,
      parameters: def.params,
    },
  }));
}

module.exports = { ACTIONS, toToolDefinitions };
