require("dotenv").config();
const { startListening } = require("./wakeWord");
const { transcribe } = require("./stt");
const { speak } = require("./speak");
const deviceAgent = require("../deviceControl/agentLoop");
const { route } = require("../router");
const brain = require("../memory/brainStore");

/**
 * VOICE AGENT (standalone process)
 * ---------------------------------
 * Run this alongside (or instead of) the web server for hands-free control:
 *
 *   node server/voice/voiceAgent.js
 *
 * Say the wake word, then your instruction. It picks whether that's a
 * device-control task (opens apps, taps your phone, sends messages...) or
 * a plain question, runs it, and speaks back BOTH progress as it works
 * through multi-step tasks and the final result — not just a silent
 * pause followed by one final reply.
 *
 * This process talks to deviceAgent/router directly (no HTTP hop), so it
 * always shares the same session as anything paired to VOICE_SESSION_ID —
 * that's the session id your Android companion app should pair with too.
 */

const VOICE_SESSION_ID = process.env.VOICE_SESSION_ID || "voice-loop";

// Rough heuristic: does this sound like "do something on my device" or
// "answer/tell me something"? Device-ish verbs win; ambiguous cases still
// default to the device agent since it can reply in plain text too when an
// instruction turns out not to need any tool call.
const DEVICE_VERBS = [
  "open", "close", "click", "tap", "swipe", "type", "send", "call", "message",
  "whatsapp", "instagram", "screenshot", "volume", "shutdown", "restart",
  "sleep", "scroll", "press", "delete", "move", "read screen", "run",
<<<<<<< HEAD
  "browse", "search", "youtube", "spotify", "edge", "chrome", "website",
  "web", "url", "play", "pause", "launch", "google", "find", "mute",
=======
>>>>>>> 9422c3abfb40b468243a8ad777f3982b1242aa16
];

function looksLikeDeviceCommand(text) {
  const lower = text.toLowerCase();
  return DEVICE_VERBS.some((v) => lower.includes(v));
}

<<<<<<< HEAD
function cleanWakePrefix(raw) {
  if (!raw) return "";
  // Strip leading wake phrases like "Sia,", "Hey Sia,", "Hi Sia,", "Ok Sia,", "Jarvis,"
  return raw
    .replace(/^(hey\s+sia|hi\s+sia|ok\s+sia|sia|hey\s+jarvis|jarvis)[,\s:]*/i, "")
    .trim();
}

async function handleCommand(wavFile) {
  const rawText = await transcribe(wavFile);
  if (!rawText) {
    console.log("[voice] Heard nothing usable, back to listening.");
    return;
  }

  const cleanedText = cleanWakePrefix(rawText) || rawText;
  console.log(`[voice] Sia heard: "${rawText}" -> Command: "${cleanedText}"`);

  if (looksLikeDeviceCommand(cleanedText)) {
    await speak("Right away, sir.");
    const snapshot = await deviceAgent.startTask({
      sessionId: VOICE_SESSION_ID,
      instruction: cleanedText,
      onStep: async (entry) => {
        // Narrate mid-task progress
        if (entry.type === "action" && entry.result?.ok) {
          const actionName = entry.action.replace(/_/g, " ");
          if (entry.action === "open_url") {
            await speak(`Opening in Microsoft Edge, sir.`);
          } else if (entry.action === "search_web") {
            await speak(`Searching on Microsoft Edge, sir.`);
          } else {
            await speak(`${actionName} completed, sir.`);
          }
        } else if (entry.type === "action" && entry.result?.error) {
          await speak(`Step had an issue: ${entry.result.error}`);
=======
async function handleCommand(wavFile) {
  const text = await transcribe(wavFile);
  if (!text) {
    console.log("[voice] Heard nothing usable, back to listening.");
    return;
  }
  console.log(`[voice] Heard: "${text}"`);

  if (looksLikeDeviceCommand(text)) {
    await speak("On it.");
    const snapshot = await deviceAgent.startTask({
      sessionId: VOICE_SESSION_ID,
      instruction: text,
      onStep: async (entry) => {
        // Narrate mid-task, not just at the end.
        if (entry.type === "action" && entry.result?.ok) {
          await speak(`${entry.action.replace(/_/g, " ")}, done.`);
        } else if (entry.type === "confirmation_needed") {
          await speak(`I need your approval before I ${entry.action.replace(/_/g, " ")}. Check the app to confirm.`);
        } else if (entry.type === "action" && entry.result?.error) {
          await speak(`That step failed: ${entry.result.error}`);
>>>>>>> 9422c3abfb40b468243a8ad777f3982b1242aa16
        }
      },
    });
    if (snapshot.finalAnswer) await speak(snapshot.finalAnswer);
  } else {
    const persistedHistory = brain.getContextForModel(VOICE_SESSION_ID);
<<<<<<< HEAD
    const result = await route({ message: cleanedText, history: persistedHistory });
    await brain.appendMessage(VOICE_SESSION_ID, "user", rawText);
=======
    const result = await route({ message: text, history: persistedHistory });
    await brain.appendMessage(VOICE_SESSION_ID, "user", text);
>>>>>>> 9422c3abfb40b468243a8ad777f3982b1242aa16
    await brain.appendMessage(VOICE_SESSION_ID, "assistant", result.answer);
    await speak(result.answer);
  }
}

<<<<<<< HEAD
console.log("[voice] Sia voice agent online. Ready for command, sir.");
startListening({
  onWake: async () => {
    console.log("[voice] Sia awake — listening for command, sir...");
  },
=======
console.log("[voice] Starting voice agent...");
startListening({
  onWake: () => console.log("[voice] Wake word heard — listening for your command..."),
>>>>>>> 9422c3abfb40b468243a8ad777f3982b1242aa16
  onCommand: handleCommand,
  onError: (err) => console.error("[voice] Error:", err.message),
});
