
require("dotenv").config();
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const { route } = require("./router");
const { classify } = require("./classifier");
const { MODEL_REGISTRY } = require("./modelRegistry");
const brain = require("./memory/brainStore");
const knowledgeGraph = require("./memory/knowledgeGraph");
const { sessionMiddleware } = require("./session");
const auth = require("./auth");
const deviceAgent = require("./deviceControl/agentLoop");
const { ACTIONS } = require("./deviceControl/actionRegistry");
const mobileBridge = require("./deviceControl/mobileBridge");
const { streamOpenRouterCompletion } = require("./openrouterClient");
const { runCouncilConsensus } = require("./consensusEngine");
const { processUploadedFile, formatMultimodalMessage } = require("./fileHandler");
const mcpClient = require("./plugins/mcpClient");
const { getModelByIdSync, matchBestModelFrom300, getAllModels } = require("./modelsCatalog");
const { semanticCache } = require("./semanticCache");
const { goalPlanner } = require("./goalPlanner");
const { ambientSentinel } = require("./ambientSentinel");
const { tryFastDispatch } = require("./fastDispatcher");

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
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

// Rate limits (Unrestricted for seamless local usage)
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — slow down and try again in a few minutes." },
});

const deviceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many device-control requests — slow down and try again in a few minutes." },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
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

  try {
    // 1. Fast-Path Direct Dispatch (<50ms execution)
    if (!forceModel) {
      const fastResult = await tryFastDispatch(text);
      if (fastResult.matched) {
        await brain.appendMessage(sid, "user", text);
        await brain.appendMessage(sid, "assistant", fastResult.answer);
        return res.json({
          reply: fastResult.answer,
          answer: fastResult.answer,
          steps: fastResult.steps,
          routing: {
            category: "fast_dispatch",
            modelLabel: "⚡ Instant Dispatcher (<50ms)",
            why: "Direct deterministic command executed instantly without network latency.",
          },
        });
      }
    }

    const DEVICE_VERBS = [
      "open", "close", "click", "tap", "swipe", "type", "send", "call", "message",
      "whatsapp", "instagram", "screenshot", "volume", "shutdown", "restart",
      "sleep", "scroll", "press", "delete", "move", "read screen", "run",
      "browse", "search", "youtube", "spotify", "edge", "chrome", "website",
      "web", "url", "play", "pause", "launch", "google", "find", "mute",
    ];
    const isDeviceCommand = !forceModel && DEVICE_VERBS.some((v) => text.toLowerCase().includes(v));

    if (isDeviceCommand) {
      const snapshot = await deviceAgent.startTask({ sessionId: sid, instruction: text });
      return res.json({
        reply: snapshot.finalAnswer || "Done.",
        answer: snapshot.finalAnswer || "Done.",
        steps: snapshot.log,
        taskId: snapshot.taskId,
      });
    }
    const persistedHistory = brain.getContextForModel(sid);
    const result = await route({ message: text, history: persistedHistory, forceModel });
    await brain.appendMessage(sid, "user", text);
    await brain.appendMessage(sid, "assistant", result.answer);
    return res.json({ reply: result.answer, answer: result.answer, routing: result.routing });
  } catch (err) {
    console.error("/api/voice-command failed:", err);
    res.status(500).json({ error: "Something went wrong handling that voice command." });
  }
});

// Protected Endpoints (Requires auth cookie if SIA_PASSWORD is set)
app.use("/api", auth.requireAuth);

// --- Real-Time SSE Token & Reasoning Streaming Endpoint ---
app.post("/api/chat/stream", chatLimiter, async (req, res) => {
  const { message, files = [], forceCategory, forceModel } = req.body || {};
  if (!message && (!files || files.length === 0)) {
    return res.status(400).json({ error: "message or attached file is required" });
  }

  const sessionId = req.sessionId;
  const userText = message || "(analyzing attached file)";

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // 1. Autonomous Multi-Step Goal Planner (Auto-DAG)
    if (!forceModel && files.length === 0 && (!forceCategory || forceCategory === "auto" || forceCategory === "auto_300")) {
      if (goalPlanner.isCompoundGoal(userText)) {
        const dag = goalPlanner.decompose(userText);
        sendEvent("routing", {
          category: "autonomous_dag",
          classifiedBy: "goal_planner",
          model: "auto-dag-engine",
          modelLabel: "🌐 Autonomous Goal Planner (Auto-DAG)",
          why: `Decomposed multi-step goal into ${dag.totalSteps} sequential sub-tasks.`,
        });
        sendEvent("dag_init", dag);

        const executionReport = await goalPlanner.executeDAG(dag, {
          sessionId,
          onStepUpdate: (step) => sendEvent("dag_step", step),
        });

        await brain.appendMessage(sessionId, "user", userText);
        await brain.appendMessage(sessionId, "assistant", executionReport.summary);

        sendEvent("token", { content: executionReport.summary });
        sendEvent("dag_complete", executionReport);
        sendEvent("done", { ok: true, answer: executionReport.summary, dag: executionReport });
        return res.end();
      }

      // 1B. Fast-Path Direct Dispatch (<10ms execution)
      const fastResult = await tryFastDispatch(userText);
      if (fastResult.matched) {
        await brain.appendMessage(sessionId, "user", userText);
        await brain.appendMessage(sessionId, "assistant", fastResult.answer);

        sendEvent("routing", {
          category: "device_control",
          classifiedBy: "fast_dispatcher",
          model: "direct-dispatch",
          modelLabel: "⚡ Instant Dispatcher (<50ms)",
          why: "Direct deterministic command executed instantly without network latency.",
        });
        sendEvent("token", { content: fastResult.answer });
        sendEvent("steps", { steps: fastResult.steps });
        sendEvent("done", { ok: true, answer: fastResult.answer });
        return res.end();
      }

      // 1C. Sub-Millisecond Semantic LRU Cache (<1ms execution)
      const cached = semanticCache.get(userText);
      if (cached) {
        await brain.appendMessage(sessionId, "user", userText);
        await brain.appendMessage(sessionId, "assistant", cached.answer);

        sendEvent("routing", cached.routing || {
          category: "cached",
          classifiedBy: "semantic_lru_cache",
          model: "in-memory-lru",
          modelLabel: "⚡ In-Memory Semantic Cache (<1ms)",
          why: `Instant cache hit (${cached.matchType} match, $0 API credit cost).`,
        });
        sendEvent("token", { content: cached.answer });
        sendEvent("steps", { steps: cached.steps || [] });
        sendEvent("done", { ok: true, answer: cached.answer, fromCache: true });
        return res.end();
      }
    }

    // 2. Resolve Model and Category
    let targetModel = null;
    let modelLabel = null;
    let categoryName = "general";
    let classifiedBy = "300_model_matcher";
    let why = "Auto-selected #1 AI model among 300+ models";

    const hasImages = files.some((f) => f.kind === "image");

    if (forceModel) {
      targetModel = forceModel;
      const catEntry = getModelByIdSync(forceModel);
      modelLabel = catEntry ? catEntry.name : forceModel;
      categoryName = catEntry?.category || "custom";
      classifiedBy = "user_override";
      why = `Manually selected model: ${modelLabel}`;
    } else if (hasImages) {
      targetModel = "google/gemini-2.0-flash-001";
      modelLabel = "Gemini 2.0 Flash (Multimodal Vision)";
      categoryName = "vision";
      classifiedBy = "multimodal_detector";
      why = "Attached image routed to Google Gemini 2.0 Flash for vision analysis.";
    } else if (forceCategory && MODEL_REGISTRY[forceCategory]) {
      const entry = MODEL_REGISTRY[forceCategory];
      targetModel = entry.model;
      modelLabel = entry.label;
      categoryName = forceCategory;
      classifiedBy = "category_override";
      why = entry.why;
    } else {
      const classification = await classify(userText);
      if (classification.category === "device_control") {
        // Device control execution
        sendEvent("routing", {
          category: "device_control",
          classifiedBy: classification.method,
          model: MODEL_REGISTRY.device_control.model,
          modelLabel: `${MODEL_REGISTRY.device_control.label} (device agent)`,
          why: "Instruction required real system/app actions — executing agent tool loop.",
        });

        const snapshot = await deviceAgent.startTask({
          sessionId,
          instruction: userText,
          onStep: (entry) => {
            sendEvent("agent_step", entry);
          },
        });

        await brain.appendMessage(sessionId, "user", userText);
        await brain.appendMessage(sessionId, "assistant", snapshot.finalAnswer || "Done.");

        sendEvent("token", { content: snapshot.finalAnswer || "Done." });
        sendEvent("steps", { steps: snapshot.log, taskId: snapshot.taskId });
        sendEvent("done", { ok: true, answer: snapshot.finalAnswer || "Done." });
        return res.end();
      }

      const bestMatch = matchBestModelFrom300(userText);
      targetModel = bestMatch.model;
      modelLabel = bestMatch.modelLabel;
      categoryName = bestMatch.category;
      classifiedBy = "300_model_matcher";
      why = bestMatch.why;
    }

    sendEvent("routing", {
      category: categoryName,
      classifiedBy,
      model: targetModel,
      modelLabel,
      why,
    });

    const persistedHistory = brain.getContextForModel(sessionId);
    const multimodalUserContent = formatMultimodalMessage(userText, files);

    const messages = [
      { role: "system", content: siaIdentity.systemPrompt() },
      ...persistedHistory,
      { role: "user", content: multimodalUserContent },
    ];

    const streamResult = await streamOpenRouterCompletion({
      model: targetModel,
      messages,
      onChunk: ({ content, reasoning, done, model }) => {
        if (reasoning) {
          sendEvent("reasoning", { text: reasoning });
        }
        if (content) {
          sendEvent("token", { content });
        }
        if (done) {
          sendEvent("stream_done", { model });
        }
      },
    });

    await brain.appendMessage(sessionId, "user", userText);
    await brain.appendMessage(sessionId, "assistant", streamResult.answer);

    sendEvent("done", {
      ok: true,
      answer: streamResult.answer,
      reasoning: streamResult.reasoning,
    });
    res.end();
  } catch (err) {
    console.error("[SSE Stream Error]:", err);
    sendEvent("error", { error: err.message || "Streaming failed." });
    res.end();
  }
});

// --- Council of AI Consensus Endpoint ---
app.post("/api/chat/consensus", chatLimiter, async (req, res) => {
  const { message } = req.body || {};
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "message (string) is required" });
  }

  const sessionId = req.sessionId;

  try {
    const persistedHistory = brain.getContextForModel(sessionId);
    const result = await runCouncilConsensus({ message, history: persistedHistory });

    await brain.appendMessage(sessionId, "user", `[Council Consensus Request] ${message}`);
    await brain.appendMessage(sessionId, "assistant", result.masterAnswer);

    res.json({
      ok: true,
      answer: result.masterAnswer,
      perspectives: result.perspectives,
      consensusCount: result.consensusCount,
      routing: {
        category: "consensus",
        modelLabel: "🏛️ Council of 3 Flagship Models",
        why: "Multi-model deliberation across Claude 3.5 Sonnet, DeepSeek R1, and GPT-4o.",
      },
    });
  } catch (err) {
    console.error("[Council Consensus Error]:", err);
    res.status(500).json({ error: err.message || "Consensus deliberation failed." });
  }
});

// --- Multimodal File Processing Endpoint ---
app.post("/api/files/process", (req, res) => {
  const { name, type, dataUrl, textContent } = req.body || {};
  if (!name) {
    return res.status(400).json({ error: "File name is required" });
  }

  try {
    const processed = processUploadedFile({ name, type, dataUrl, textContent });
    res.json({ ok: true, file: processed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Knowledge Graph Memory Endpoints ---
app.get("/api/memory/knowledge", (req, res) => {
  const knowledge = knowledgeGraph.readKnowledge(req.sessionId);
  res.json({ ok: true, knowledge });
});

app.post("/api/memory/knowledge", (req, res) => {
  const { category, key, value } = req.body || {};
  if (!value) {
    return res.status(400).json({ error: "value is required" });
  }
  const updated = knowledgeGraph.addFact(req.sessionId, category, key, value);
  res.json({ ok: true, knowledge: updated });
});

app.delete("/api/memory/knowledge/:factId", (req, res) => {
  const updated = knowledgeGraph.deleteFact(req.sessionId, req.params.factId);
  res.json({ ok: true, knowledge: updated });
});

// --- MCP Server Management Endpoints ---
app.get("/api/mcp/servers", (req, res) => {
  const config = mcpClient.getMcpConfig();
  const activeTools = mcpClient.getActiveTools();
  res.json({ ok: true, servers: config.servers || [], activeTools });
});

app.post("/api/mcp/servers", (req, res) => {
  const { server } = req.body || {};
  if (!server || !server.name) {
    return res.status(400).json({ error: "Valid server object is required" });
  }
  const config = mcpClient.getMcpConfig();
  const existingIndex = config.servers.findIndex((s) => s.name === server.name);
  if (existingIndex >= 0) {
    config.servers[existingIndex] = { ...config.servers[existingIndex], ...server };
  } else {
    config.servers.push(server);
  }
  mcpClient.saveMcpConfig(config);
  res.json({ ok: true, config });
});

// Main chat endpoint (Legacy REST fallback)
app.post("/api/chat", chatLimiter, async (req, res) => {
  const { message, forceCategory, forceModel } = req.body || {};
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "message (string) is required" });
  }
  if (message.length > 120000) {
    return res.status(400).json({ error: "message is too long (max 120,000 characters)" });
  }

  const sessionId = req.sessionId;

  try {
// ... [rest of the document unchanged until the legacy REST fallback]

    // 1. Fast-Path Direct Dispatch & Goal Planner (<50ms execution)
    if (!forceModel && (!forceCategory || forceCategory === "auto" || forceCategory === "auto_300")) {
      if (goalPlanner.isCompoundGoal(message)) {
        const dag = goalPlanner.decompose(message);
        const executionReport = await goalPlanner.executeDAG(dag, { sessionId });
        await brain.appendMessage(sessionId, "user", message);
        await brain.appendMessage(sessionId, "assistant", executionReport.summary);
        return res.json({
          answer: executionReport.summary,
          routing: {
            category: "autonomous_dag",
            classifiedBy: "goal_planner",
            model: "auto-dag-engine",
            modelLabel: "🌐 Autonomous Goal Planner (Auto-DAG)",
            why: `Decomposed multi-step goal into ${dag.totalSteps} sequential sub-tasks.`,
          },
          dag: executionReport,
        });
      }

      const cached = semanticCache.get(message);
      if (cached) {
         await brain.appendMessage(sessionId, "user", message);
         await brain.appendMessage(sessionId, "assistant", cached.answer);
         return res.json({ ...cached, cached: true });
      }

      const fastResult = await tryFastDispatch(message);
      if (fastResult.matched) {
        await brain.appendMessage(sessionId, "user", message);
        await brain.appendMessage(sessionId, "assistant", fastResult.answer);
        return res.json({
          answer: fastResult.answer,
          routing: {
            category: "device_control",
            classifiedBy: "fast_dispatcher",
            model: "direct-dispatch",
            modelLabel: "⚡ Instant Dispatcher (<50ms)",
            why: "Direct deterministic command executed instantly without network latency.",
          },
          steps: fastResult.steps,
        });
      }
    }

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

    // Save to Semantic LRU Cache for sub-millisecond future recall
    semanticCache.set(message, result);

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
    // 1. High-Performance Instant Dispatch (<50ms execution)
    const fastResult = await tryFastDispatch(instruction);
    if (fastResult && fastResult.matched) {
      console.log(`[DeviceCommand] Fast dispatch hit for: "${instruction}" (<50ms)`);
      const steps = (fastResult.steps || []).map((s) => ({
        type: "action",
        action: s.action,
        params: s.params,
        result: { ok: true, ...(typeof s.result === "object" ? s.result : { value: s.result }) },
      }));
      const snapshot = {
        taskId: `fast_${Date.now()}`,
        status: "done",
        finalAnswer: fastResult.answer || "Command executed successfully, sir.",
        log: [
          ...steps,
          { type: "final", content: fastResult.answer || "Command executed successfully, sir." },
        ],
        pendingConfirmation: null,
      };
      return res.json(snapshot);
    }

    // 2. Autonomous Multi-Action Goal Planner (Auto-DAG)
    if (goalPlanner && goalPlanner.isCompoundGoal(instruction)) {
      console.log(`[DeviceCommand] Compound goal detected: "${instruction}". Executing Auto-DAG...`);
      const plan = await goalPlanner.decomposeIntoDAG(instruction);
      const planResult = await goalPlanner.executePlan(plan, { sessionId: req.sessionId });
      const steps = (planResult.executedNodes || []).map((n) => ({
        type: "action",
        action: n.action,
        params: n.params,
        result: { ok: true, ...(typeof n.result === "object" ? n.result : { value: n.result }) },
      }));
      const snapshot = {
        taskId: `dag_${plan.id}`,
        status: "done",
        finalAnswer: planResult.summary || "Autonomous DAG workflow completed successfully, sir.",
        log: [
          ...steps,
          { type: "final", content: planResult.summary || "Autonomous DAG workflow completed successfully, sir." },
        ],
        pendingConfirmation: null,
      };
      return res.json(snapshot);
    }

    // 3. Fall back to LLM Tool Loop (with offline sovereign fallback)
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

// --- System Health & Diagnostics ---
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    modelsCatalogTotal: 470,
    version: "2.5.0",
    platform: process.platform,
    arch: process.arch,
  });
});

// Ambient Sentinel & Semantic Cache Telemetry Endpoints
app.get("/api/sentinel/status", (req, res) => {
  res.json({ ok: true, report: ambientSentinel.getHealthReport() });
});

app.get("/api/sentinel/briefing", (req, res) => {
  res.json({ ok: true, briefing: ambientSentinel.getBriefing() });
});

app.get("/api/cache/stats", (req, res) => {
  res.json({ ok: true, stats: semanticCache.getStats() });
});

const PORT = process.env.PORT || 3000;
const httpServer = app.listen(PORT, () => {
  console.log(`Sia orchestrator running at http://localhost:${PORT}`);
  ambientSentinel.start();

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

// Graceful shutdown handling
function handleShutdown(signal) {
  console.log(`\n[Sia] Received ${signal}. Shutting down gracefully...`);
  httpServer.close(() => {
    console.log("[Sia] Server closed cleanly.");
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000);
}

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));
