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
  "browse", "search", "youtube", "spotify", "edge", "chrome", "website",
  "web", "url", "play", "pause", "launch", "google", "find", "mute",
];

function looksLikeDeviceCommand(text) {
  const lower = text.toLowerCase();
  return DEVICE_VERBS.some((v) => lower.includes(v));
}

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
        }
      },
    });
    if (snapshot.finalAnswer) await speak(snapshot.finalAnswer);
  } else {
    const persistedHistory = brain.getContextForModel(VOICE_SESSION_ID);
    const result = await route({ message: cleanedText, history: persistedHistory });
    await brain.appendMessage(VOICE_SESSION_ID, "user", rawText);
    await brain.appendMessage(VOICE_SESSION_ID, "assistant", result.answer);
    await speak(result.answer);
  }
}

console.log("[voice] Sia voice agent online. Ready for command, sir.");
startListening({
  onWake: async () => {
    console.log("[voice] Sia awake — listening for command, sir...");
  },
  onCommand: handleCommand,
  onError: (err) => console.error("[voice] Error:", err.message),
});
