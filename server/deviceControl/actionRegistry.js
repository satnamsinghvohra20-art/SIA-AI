const system = require("./handlers/system");
const files = require("./handlers/files");
const scripts = require("./handlers/scripts");
const whatsapp = require("./handlers/whatsapp");
const instagram = require("./handlers/instagram");
const calls = require("./handlers/calls");
const ui = require("./handlers/uiControl");
const mobile = require("./handlers/mobile");

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
    description: "Open an application on this machine (e.g. chrome, calculator, notepad).",
    risk: "safe",
    params: {
      type: "object",
      properties: { app: { type: "string", description: "Friendly app name" } },
      required: ["app"],
    },
    handler: system.openApp,
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
    description: "Send a WhatsApp message via the configured Twilio WhatsApp sender.",
    risk: "risky",
    params: {
      type: "object",
      properties: {
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

  place_call: {
    description: "Place an outbound phone call via Twilio that speaks a message aloud.",
    risk: "risky",
    params: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient phone number, e.g. +919876543210" },
        message: { type: "string" },
      },
      required: ["to", "message"],
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
