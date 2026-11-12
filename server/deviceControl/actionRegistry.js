const system = require("./handlers/system");
const files = require("./handlers/files");
const scripts = require("./handlers/scripts");
const whatsapp = require("./handlers/whatsapp");
const instagram = require("./handlers/instagram");
const calls = require("./handlers/calls");
const ui = require("./handlers/uiControl");
const mobile = require("./handlers/mobile");
const screenReader = require("./handlers/screenReader");

/**
 * ACTION REGISTRY (Owner Direct Mode — Zero Protocols / Immediate Execution)
 * --------------------------------------------------------------------------
 * Every action Sia's device-control agent can take, in one place.
 * All actions execute immediately when ordered by the owner with zero blocking
 * confirmation prompts.
 *
 * `params` is a JSON-schema-ish description passed straight to the model
 * as an OpenAI-style tool definition (OpenRouter speaks this format for
 * tool-calling-capable models).
 */
const ACTIONS = {
  open_app: {
    description:
      "Open or switch to an application or web service on this machine (e.g. whatsapp, youtube, spotify, flipkart, amazon, instagram, edge, chrome, notepad, calc). " +
      "If the app or website is already open from a previous task, it reuses and brings the existing window to the front instead of opening a duplicate web tab. " +
      "Can also directly search/play on the platform if 'query' is provided (e.g. app: 'youtube', query: 'AC/DC' or app: 'spotify', query: 'coldplay').",
    risk: "safe",
    params: {
      type: "object",
      properties: {
        app: { type: "string", description: "Friendly app name, web service, or domain" },
        query: { type: "string", description: "Optional search query, video, song, topic, or message to look up within the app" },
      },
      required: ["app"],
    },
    handler: system.openApp,
  },
  open_url: {
    description:
      "Open a website URL in the browser on this computer. If the website is already open in an existing window, it will focus the existing window instead of creating duplicate tabs.",
    risk: "safe",
    params: {
      type: "object",
      properties: {
        url: { type: "string", description: "The full URL or web address to open" },
        browser: { type: "string", description: "Browser to use (default: 'default')" },
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
    risk: "safe",
    params: {
      type: "object",
      properties: { action: { type: "string", enum: ["shutdown", "restart", "sleep"] } },
      required: ["action"],
    },
    handler: system.systemPower,
  },
  media_control: {
    description: "Control system audio and media playback (play_pause, next, previous, stop).",
    risk: "safe",
    params: {
      type: "object",
      properties: { action: { type: "string", enum: ["play_pause", "next", "previous", "stop"] } },
      required: ["action"],
    },
    handler: system.mediaControl,
  },
  window_control: {
    description: "Manage windows: show desktop / minimize all windows, or minimize, maximize, restore, or close active window.",
    risk: "safe",
    params: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["show_desktop", "minimize_all", "minimize", "maximize", "restore", "close"] },
        title: { type: "string", description: "Optional window title or app name to target" },
      },
      required: ["action"],
    },
    handler: system.windowControl,
  },
  clipboard_control: {
    description: "Read, copy text to, or clear the system clipboard.",
    risk: "safe",
    params: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["read", "copy", "clear"] },
        text: { type: "string", description: "Text to copy to clipboard (if action is copy)" },
      },
      required: ["action"],
    },
    handler: system.clipboardControl,
  },
  set_brightness: {
    description: "Adjust the display/monitor brightness level (0-100 percent).",
    risk: "safe",
    params: {
      type: "object",
      properties: { percent: { type: "number", description: "Brightness level percentage 0-100" } },
      required: ["percent"],
    },
    handler: system.setBrightness,
  },
  lock_workstation: {
    description: "Lock the computer workstation/screen immediately.",
    risk: "safe",
    params: { type: "object", properties: {} },
    handler: system.lockWorkstation,
  },
  list_running_apps: {
    description: "List all currently open windows and running desktop applications with their titles and process IDs.",
    risk: "safe",
    params: { type: "object", properties: {} },
    handler: system.listRunningApps,
  },
  list_dir: {
    description: "List files and folders in any directory on the system (e.g. Desktop, Downloads, Documents, or project folders).",
    risk: "safe",
    params: {
      type: "object",
      properties: { dir: { type: "string", description: "Directory path (e.g. 'Desktop', 'Downloads', '.' or full path)" } },
    },
    handler: files.listDir,
  },
  read_file: {
    description: "Read any file content from the filesystem (e.g. source code, text, documents).",
    risk: "safe",
    params: {
      type: "object",
      properties: { file: { type: "string", description: "File path (relative or absolute)" } },
      required: ["file"],
    },
    handler: files.readFile,
  },
  write_file: {
    description: "Create or overwrite any file on the filesystem with specified content.",
    risk: "safe",
    params: {
      type: "object",
      properties: { file: { type: "string", description: "File path" }, content: { type: "string", description: "File content" } },
      required: ["file", "content"],
    },
    handler: files.writeFile,
  },
  move_file: {
    description: "Move or rename any file or directory.",
    risk: "safe",
    params: {
      type: "object",
      properties: { from: { type: "string" }, to: { type: "string" } },
      required: ["from", "to"],
    },
    handler: files.moveFile,
  },
  delete_file: {
    description: "Delete a file or folder from the filesystem.",
    risk: "safe",
    params: {
      type: "object",
      properties: { file: { type: "string" } },
      required: ["file"],
    },
    handler: files.deleteFile,
  },

  run_command: {
    description:
      "Execute any shell, terminal, or system command directly on the host computer (PowerShell, Bash, CMD, Node, Python, Git, etc.).",
    risk: "safe",
    params: {
      type: "object",
      properties: {
        command: { type: "string", description: "The command to run (e.g. 'git status', 'dir', 'python script.py', 'npm test')" },
        cwd: { type: "string", description: "Optional working directory" },
      },
      required: ["command"],
    },
    handler: scripts.runCommand,
  },

  run_script: {
    description:
      "Run a script by name from server/deviceControl/scripts/ or execute as a system command.",
    risk: "safe",
    params: {
      type: "object",
      properties: {
        name: { type: "string", description: "Script name or command" },
        args: { type: "array", items: { type: "string" } },
      },
      required: ["name"],
    },
    handler: scripts.runScript,
  },

  send_whatsapp_message: {
    description:
      "Send or draft a WhatsApp message to a contact name or phone number on WhatsApp Web or WhatsApp Desktop. Reuses the already open WhatsApp window if present without opening a new browser tab.",
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
    risk: "safe",
    params: {
      type: "object",
      properties: {
        username: { type: "string", description: "Instagram username to message" },
        message: { type: "string" },
      },
      required: ["username", "message"],
    },
    handler: instagram.sendInstagramMessage,
  },
  // --- Desktop UI control: works on ANY app, not just ones with an API ---
  ui_click: {
    description: "Click (or double-click) at a screen coordinate on this computer, in any app.",
    risk: "safe",
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
    risk: "safe",
    params: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    },
    handler: ui.typeText,
  },
  ui_press_key: {
    description: "Press a key or key combo on this computer, e.g. 'enter', 'escape', 'cmd+c', 'ctrl+v'.",
    risk: "safe",
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
    risk: "safe",
    params: {
      type: "object",
      properties: { x: { type: "number" }, y: { type: "number" } },
      required: ["x", "y"],
    },
    handler: mobile.tap,
  },
  mobile_swipe: {
    description: "Swipe on the connected Android phone's screen from one point to another.",
    risk: "safe",
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
    risk: "safe",
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
    risk: "safe",
    params: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient phone number, e.g. +919876543210" },
      },
      required: ["to"],
    },
    handler: calls.placeCall,
  },

  ground_ui_element: {
    description:
      "Visually locate any UI element, button, search bar, icon, or link on screen using high-resolution screenshot vision grounding and return exact (X, Y) pixel coordinates.",
    risk: "safe",
    params: {
      type: "object",
      properties: {
        targetDescription: { type: "string", description: "Visual description of the button, field, icon or text to locate" },
      },
      required: ["targetDescription"],
    },
    handler: (args) => require("./visionGrounding").groundElementCoordinates(args),
  },

  verify_action_result: {
    description: "Take a verification screenshot after an action to confirm that the UI state updated as expected.",
    risk: "safe",
    params: {
      type: "object",
      properties: {
        expectedOutcome: { type: "string", description: "What visual outcome to verify on screen" },
      },
      required: ["expectedOutcome"],
    },
    handler: (args) => require("./visionGrounding").verifyActionResult(args),
  },
};

function toToolDefinitions() {
  const baseTools = Object.entries(ACTIONS).map(([name, def]) => ({
    type: "function",
    function: {
      name,
      description: def.description,
      parameters: def.params,
    },
  }));

  try {
    const mcp = require("../plugins/mcpClient");
    const mcpTools = mcp.getActiveTools().map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.params,
      },
    }));
    return [...baseTools, ...mcpTools];
  } catch (_) {
    return baseTools;
  }
}

module.exports = { ACTIONS, toToolDefinitions };
