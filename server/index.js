require("dotenv").config();
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const { route } = require("./router");
const { classify } = require("./classifier");
const { MODEL_REGISTRY } = require("./modelRegistry");
const brain = require("./memory/brainStore");
const { sessionMiddleware } = require("./session");
const auth = require("./auth");
const deviceAgent = require("./deviceControl/agentLoop");
const { ACTIONS } = require("./deviceControl/actionRegistry");
const mobileBridge = require("./deviceControl/mobileBridge");

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "..", "client")));

// ElevenLabs Premade Free Tier Voices
const ELEVENLABS_VOICES = {
  alice: { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice (British, Confident)" },
  george: { id: "JBFqnCBsd6RMkjVDRZzb", name: "George (Warm, Storyteller)" },
  sarah: { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah (Soft & Natural)" },
  charlie: { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie (Casual & Friendly)" },
  daniel: { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel (Deep & Authoritative)" },
  charlotte: { id: "XB0fDUnXU5powFXDhCwa", name: "Charlotte (Gentle & Calm)" },
  liam: { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam (Young & Energetic)" },
};

// Rate limits
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — slow down and try again in a few minutes." },
});

// Device actions can have real-world side effects (calls, messages, power
// state) so this is capped tighter than ordinary chat.
const deviceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many device-control requests — slow down and try again in a few minutes." },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts — try again later." },
});

app.use(sessionMiddleware);

// Public Endpoints (Accessible without auth)
app.post("/api/login", loginLimiter, (req, res) => {
  const { password } = req.body || {};
  if (!auth.checkPassword(password)) {
    return res.status(401).json({ error: "Incorrect password" });
  }
  auth.issueAuthCookie(res);
  res.json({ ok: true });
});

app.post("/api/logout", (req, res) => {
  auth.clearAuthCookie(res);
  res.json({ ok: true });
});

app.get("/api/auth-status", (req, res) => {
  res.json({ authRequired: auth.authEnabled() });
});

// Expose public model registry, full 300+ model directory, and voice configuration
app.get("/api/models", async (req, res) => {
  try {
    const all = await getAllModels();
    res.json({
      categories: MODEL_REGISTRY,
      models: all,
      total: all.length,
    });
  } catch (err) {
    res.json({
      categories: MODEL_REGISTRY,
      models: [],
      total: Object.keys(MODEL_REGISTRY).length,
    });
  }
});

app.get("/api/tts/config", (req, res) => {
  res.json({
    hasElevenLabs: Boolean(process.env.ELEVENLABS_API_KEY),
    voices: ELEVENLABS_VOICES,
    defaultVoice: process.env.ELEVENLABS_VOICE_ID || "Xb7hH8MSUJpSbSDYk0k2",
  });
});

// Voice-command bridge (used by the iOS Shortcut and any other headless
// client that can't do cookie-based login). Auth is a header instead of a
// cookie for this one route, since Siri Shortcuts can't run the login flow.
// Text in, text out — the caller (Shortcut's "Speak Text" action, or the
// Android app's own TTS) is responsible for the actual audio.
app.post("/api/voice-command", chatLimiter, async (req, res) => {
  if (!auth.checkPassword(req.headers["x-sia-password"])) {
    return res.status(401).json({ error: "Missing/incorrect X-Sia-Password header" });
  }

  const { text, sessionId, forceModel } = req.body || {};
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "text (string) is required" });
  }

  const sid = sessionId || process.env.VOICE_SESSION_ID || "voice-loop";
  const DEVICE_VERBS = [
    "open", "close", "click", "tap", "swipe", "type", "send", "call", "message",
    "whatsapp", "instagram", "screenshot", "volume", "shutdown", "restart",
    "sleep", "scroll", "press", "delete", "move", "read screen", "run",
    "browse", "search", "youtube", "spotify", "edge", "chrome", "website",
    "web", "url", "play", "pause", "launch", "google", "find", "mute",
  ];
  const isDeviceCommand = !forceModel && DEVICE_VERBS.some((v) => text.toLowerCase().includes(v));

  try {
    if (isDeviceCommand) {
      const snapshot = await deviceAgent.startTask({ sessionId: sid, instruction: text });
      return res.json({ reply: snapshot.finalAnswer || "Done.", steps: snapshot.log, taskId: snapshot.taskId });
    }
    const persistedHistory = brain.getContextForModel(sid);
    const result = await route({ message: text, history: persistedHistory, forceModel });
    await brain.appendMessage(sid, "user", text);
    await brain.appendMessage(sid, "assistant", result.answer);
    return res.json({ reply: result.answer, routing: result.routing });
  } catch (err) {
    console.error("/api/voice-command failed:", err);
    res.status(500).json({ error: "Something went wrong handling that voice command." });
  }
});

// Protected Endpoints (Requires auth cookie if SIA_PASSWORD is set)
app.use("/api", auth.requireAuth);

// Main chat endpoint
app.post("/api/chat", chatLimiter, async (req, res) => {
  const { message, forceCategory, forceModel } = req.body || {};
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "message (string) is required" });
  }
  if (message.length > 8000) {
    return res.status(400).json({ error: "message is too long (max 8000 characters)" });
  }

  const sessionId = req.sessionId;

  try {
    const persistedHistory = brain.getContextForModel(sessionId);
    const autoClassification = await classify(message);
    const isDevice = autoClassification.category === "device_control";

    const classification = (isDevice && !forceModel)
      ? autoClassification
      : (forceCategory && forceCategory !== "auto" && forceCategory !== "auto_300")
        ? { category: forceCategory, method: "manual" }
        : autoClassification;

    let result;

    if (classification.category === "device_control" && !forceModel) {
      // Direct device-control task execution
      const snapshot = await deviceAgent.startTask({ sessionId, instruction: message });
      const deviceEntry = MODEL_REGISTRY.device_control;
      result = {
        answer: snapshot.finalAnswer || "Done.",
        routing: {
          category: "device_control",
          classifiedBy: classification.method,
          model: deviceEntry.model,
          modelLabel: `${deviceEntry.label} (device agent)`,
          why: "Message required an actual device action, not just a reply — routed to the device-control agent loop.",
        },
        steps: snapshot.log,
        taskId: snapshot.taskId,
      };
    } else {
      result = await route({ message, history: persistedHistory, forceCategory: forceCategory || null, forceModel });
    }

    await brain.appendMessage(sessionId, "user", message);
    await brain.appendMessage(sessionId, "assistant", result.answer);

    res.json(result);
  } catch (err) {
    console.error(err);
    brain.logBlocker(sessionId, `/api/chat failed: ${err.message}`);
    res.status(500).json({ error: "Something went wrong handling that request." });
  }
});

// Restores this session's chat on page load
app.get("/api/history", (req, res) => {
  const state = brain.readState(req.sessionId);
  res.json({
    messages: state.recent_messages,
    summary: state.chat_summary,
    current_task: state.current_task,
  });
});

// Brain state
app.get("/api/brain", (req, res) => {
  res.json(brain.readState(req.sessionId));
});

// --- Device Control ---
// Lists available actions so the client can show what Sia can do.
app.get("/api/device/actions", (req, res) => {
  const list = Object.entries(ACTIONS).map(([name, def]) => ({
    name,
    description: def.description,
    risk: def.risk,
  }));
  res.json({ actions: list });
});

// Starts a new device-control loop task from a natural-language instruction.
app.post("/api/device/command", deviceLimiter, async (req, res) => {
  const { instruction } = req.body || {};
  if (!instruction || typeof instruction !== "string") {
    return res.status(400).json({ error: "instruction (string) is required" });
  }
  if (instruction.length > 2000) {
    return res.status(400).json({ error: "instruction is too long (max 2000 characters)" });
  }

  try {
    const snapshot = await deviceAgent.startTask({ sessionId: req.sessionId, instruction });
    res.json(snapshot);
  } catch (err) {
    console.error("device/command failed:", err);
    res.status(500).json({ error: "Something went wrong starting that device task." });
  }
});

// Approves or denies a risky action the loop is paused on, then resumes it.
app.post("/api/device/confirm", deviceLimiter, async (req, res) => {
  const { taskId, confirmationId, approved } = req.body || {};
  if (!taskId || !confirmationId || typeof approved !== "boolean") {
    return res.status(400).json({ error: "taskId, confirmationId, and approved (boolean) are required" });
  }

  try {
    const result = await deviceAgent.confirmPending({
      sessionId: req.sessionId,
      taskId,
      confirmationId,
      approved,
    });
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error("device/confirm failed:", err);
    res.status(500).json({ error: "Something went wrong resuming that device task." });
  }
});

// Fetches the current state of a device task (useful after a page reload).
app.get("/api/device/task/:taskId", (req, res) => {
  const snapshot = deviceAgent.getTaskSnapshot(req.sessionId, req.params.taskId);
  if (!snapshot) return res.status(404).json({ error: "Task not found." });
  res.json(snapshot);
});

// ElevenLabs TTS Proxy
app.post("/api/tts", async (req, res) => {
  const { text, voiceId } = req.body || {};
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "text is required" });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(400).json({ error: "ELEVENLABS_API_KEY is not configured in .env" });
  }

  const selectedVoiceId = voiceId || process.env.ELEVENLABS_VOICE_ID || "Xb7hH8MSUJpSbSDYk0k2";

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: text.slice(0, 1000),
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText || "ElevenLabs TTS request failed" });
    }

    const arrayBuffer = await response.arrayBuffer();
    res.set("Content-Type", "audio/mpeg");
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error("ElevenLabs TTS error:", err);
    res.status(500).json({ error: "TTS generation failed: " + err.message });
  }
});

const PORT = process.env.PORT || 3000;
const httpServer = app.listen(PORT, () => {
  console.log(`Sia orchestrator running at http://localhost:${PORT}`);
  if (!process.env.OPENROUTER_API_KEY) {
    console.warn(
      "\n⚠️  No OPENROUTER_API_KEY found. Copy .env.example to .env and add your key.\n"
    );
  }
  if (!auth.authEnabled()) {
    console.warn(
      "\n⚠️  No SIA_PASSWORD set — Sia is running WITHOUT auth.\n"
    );
  }
  if (!process.env.ANDROID_PAIR_TOKEN) {
    console.warn(
      "\n⚠️  No ANDROID_PAIR_TOKEN set — the Android companion app can't pair until you set one.\n"
    );
  }
});

// Android companion app connects here: ws://<host>:<port>/ws/mobile?token=...&sessionId=...
mobileBridge.attach(httpServer);
