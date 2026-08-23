const mobileBridge = require("../mobileBridge");

/**
 * MOBILE HANDLERS
 * ---------------
 * Mirrors uiControl.js but targets the phone instead of this machine.
 * Every function here just forwards a typed command to whichever Android
 * device is currently paired with this session (see mobileBridge.js) and
 * waits for the phone's Accessibility Service to report back what
 * happened. The `context.sessionId` argument is injected by executor.js —
 * it's how a command ends up on YOUR phone and not someone else's.
 */

function requireSession(context) {
  if (!context?.sessionId) throw new Error("No session context — this action must run through the device agent loop.");
  return context.sessionId;
}

async function tap(params, context) {
  return mobileBridge.sendCommand(requireSession(context), "tap", params);
}

async function swipe(params, context) {
  return mobileBridge.sendCommand(requireSession(context), "swipe", params);
}

async function typeText(params, context) {
  return mobileBridge.sendCommand(requireSession(context), "type", params);
}

async function openApp(params, context) {
  return mobileBridge.sendCommand(requireSession(context), "open_app", params);
}

async function pressKey(params, context) {
  // key: "back" | "home" | "recents"
  return mobileBridge.sendCommand(requireSession(context), "press_key", params);
}

async function readScreen(params, context) {
  // Asks the phone to dump its current Accessibility node tree as text
  // (labels, buttons, input fields) — much cheaper and more reliable than
  // a screenshot + vision-model round trip for deciding the next tap.
  return mobileBridge.sendCommand(requireSession(context), "read_screen", params);
}

async function notify(params, context) {
  // Speaks text out loud on the phone via Android's built-in TTS — used
  // for "let the phone confirm the task is done" without a round trip
  // through the desktop's ElevenLabs voice.
  return mobileBridge.sendCommand(requireSession(context), "notify", params);
}

async function openUrl(params, context) {
  // Opens any URL/deep link via the phone's own ACTION_VIEW handling —
  // e.g. a wa.me link jumps straight into a pre-filled WhatsApp chat, a
  // tel: link opens the dialer. This is what the free WhatsApp/call paths
  // in whatsapp.js/calls.js are built on.
  return mobileBridge.sendCommand(requireSession(context), "open_url", params);
}

module.exports = { tap, swipe, typeText, openApp, pressKey, readScreen, notify, openUrl };
