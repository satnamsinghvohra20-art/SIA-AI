const fs = require("fs");
const path = require("path");
const { callOpenRouter } = require("../openrouterClient");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const SESSIONS_DIR = path.join(DATA_DIR, "sessions");
const ROOT_BRAIN_MD_PATH = path.join(__dirname, "..", "..", "brain.md");

const RECENT_MESSAGE_LIMIT = 20; // keep this many raw messages before folding into summary
const SUMMARY_MODEL = "google/gemini-2.5-flash"; // cheap/fast — this is an internal bookkeeping call, not a user-facing answer
const DEFAULT_SESSION = "cli"; // used by loop.js when run standalone outside any HTTP session

// Guards against a malicious/bad sessionId (e.g. from a forged cookie) being
// used to construct a filesystem path — this is what stops path traversal
// like "../../etc/passwd" from ever reaching fs calls.
const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

function assertValidSessionId(sessionId) {
  if (!SESSION_ID_PATTERN.test(sessionId)) {
    throw new Error(`Invalid sessionId: ${JSON.stringify(sessionId)}`);
  }
}

function sessionDir(sessionId) {
  assertValidSessionId(sessionId);
  return path.join(SESSIONS_DIR, sessionId);
}

function statePath(sessionId) {
  return path.join(sessionDir(sessionId), "brain-state.json");
}

function sessionBrainMdPath(sessionId) {
  return path.join(sessionDir(sessionId), "brain.md");
}

function defaultState() {
  return {
    current_task: {
      id: null,
      goal: null,
      status: "idle",
      started_at: null,
    },
    plan: [],
    decisions_log: [],
    chat_summary: "",
    recent_messages: [],
    blockers: [],
    last_updated: new Date().toISOString(),
  };
}

function ensureSessionDir(sessionId) {
  const dir = sessionDir(sessionId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Atomic write: write to a temp file then rename over the real one.
 * A crash mid-write can never leave brain-state.json half-written/corrupt.
 */
function atomicWriteJSON(filePath, obj) {
  const tmp = filePath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, filePath);
}

function atomicWriteText(filePath, text) {
  const tmp = filePath + ".tmp";
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, filePath);
}

function readState(sessionId = DEFAULT_SESSION) {
  ensureSessionDir(sessionId);
  const p = statePath(sessionId);
  if (!fs.existsSync(p)) {
    const initial = defaultState();
    atomicWriteJSON(p, initial);
    return initial;
  }
  try {
    const raw = fs.readFileSync(p, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    // Corrupt/unreadable state should never crash the app — fall back clean
    // and log the failure into the fresh state's blockers so it's visible.
    console.error(`brainStore[${sessionId}]: failed to read state, starting fresh:`, err.message);
    const fresh = defaultState();
    fresh.blockers.push({
      at: new Date().toISOString(),
      issue: `Previous brain-state.json was unreadable: ${err.message}`,
    });
    return fresh;
  }
}

function writeState(sessionId = DEFAULT_SESSION, state) {
  ensureSessionDir(sessionId); // must not assume readState() ran first in this same process
  state.last_updated = new Date().toISOString();
  atomicWriteJSON(statePath(sessionId), state);
  regenerateBrainMdSnapshot(sessionId, state);
  return state;
}

/**
 * Regenerates the human-readable brain.md snapshot for this session.
 * Per-session snapshots live at data/sessions/<id>/brain.md so multiple
 * concurrent users never overwrite each other's snapshot. The DEFAULT_SESSION
 * (cli / loop.js runs) also mirrors its snapshot into the root brain.md,
 * since that's the file a human running the CLI loop actually looks at.
 */
function regenerateBrainMdSnapshot(sessionId, state) {
  const marker = "<!-- AUTO-GENERATED SNAPSHOT — DO NOT EDIT BELOW THIS LINE -->";

  const planLines = state.plan
    .map((s) => `- [${s.done ? "x" : " "}] ${s.text}`)
    .join("\n") || "_(no active plan)_";

  const decisionLines = state.decisions_log
    .slice(-15)
    .map((d) => `- ${d.at} — ${d.text}`)
    .join("\n") || "_(none yet)_";

  const blockerLines = state.blockers
    .slice(-10)
    .map((b) => `- ${b.at} — ${b.issue}`)
    .join("\n") || "_(none)_";

  const snapshotBody = `## snapshot: session
${sessionId}

## snapshot: current_task
- id: ${state.current_task.id || "—"}
- goal: ${state.current_task.goal || "—"}
- status: ${state.current_task.status}
- started_at: ${state.current_task.started_at || "—"}

## snapshot: plan
${planLines}

## snapshot: decisions_log (last 15)
${decisionLines}

## snapshot: chat_summary
${state.chat_summary || "_(nothing summarized yet — still within recent_messages window)_"}

## snapshot: blockers (last 10)
${blockerLines}

## snapshot: last_updated
${state.last_updated}
`;

  // Per-session snapshot file
  atomicWriteText(sessionBrainMdPath(sessionId), `${marker}\n\n${snapshotBody}`);

  // Root brain.md keeps the hand-written spec + mirrors only the CLI/default
  // session's snapshot, so it stays a single readable file for the common
  // "I ran loop.js, let me check brain.md" case without every web session
  // fighting over the same file.
  if (sessionId === DEFAULT_SESSION) {
    let existing = "";
    if (fs.existsSync(ROOT_BRAIN_MD_PATH)) {
      existing = fs.readFileSync(ROOT_BRAIN_MD_PATH, "utf-8");
    }
    const specPart = existing.split(marker)[0].trimEnd();
    atomicWriteText(ROOT_BRAIN_MD_PATH, `${specPart}\n\n${marker}\n\n${snapshotBody}`);
  }
}

function startTask(sessionId, goal, planSteps = []) {
  const state = readState(sessionId);
  state.current_task = {
    id: `task_${Date.now()}`,
    goal,
    status: "in_progress",
    started_at: new Date().toISOString(),
  };
  state.plan = planSteps.map((text) => ({ text, done: false }));
  state.decisions_log.push({
    at: new Date().toISOString(),
    text: `Started task: ${goal}`,
  });
  return writeState(sessionId, state);
}

function logDecision(sessionId, text) {
  const state = readState(sessionId);
  state.decisions_log.push({ at: new Date().toISOString(), text });
  return writeState(sessionId, state);
}

function logBlocker(sessionId, issue) {
  const state = readState(sessionId);
  state.blockers.push({ at: new Date().toISOString(), issue });
  return writeState(sessionId, state);
}

function markStepDone(sessionId, index) {
  const state = readState(sessionId);
  if (state.plan[index]) {
    state.plan[index].done = true;
  }
  const allDone = state.plan.length > 0 && state.plan.every((s) => s.done);
  if (allDone) {
    state.current_task.status = "done";
  }
  return writeState(sessionId, state);
}

/**
 * Appends one chat turn to recent_messages. If the window exceeds
 * RECENT_MESSAGE_LIMIT, the oldest overflow is folded into chat_summary
 * via a cheap model call rather than being dropped.
 */
async function appendMessage(sessionId, role, content) {
  const state = readState(sessionId);
  state.recent_messages.push({ role, content, at: new Date().toISOString() });

  if (state.recent_messages.length > RECENT_MESSAGE_LIMIT) {
    const overflowCount = state.recent_messages.length - RECENT_MESSAGE_LIMIT;
    const overflow = state.recent_messages.splice(0, overflowCount);
    state.chat_summary = await foldIntoSummary(state.chat_summary, overflow);
  }

  return writeState(sessionId, state);
}

/**
 * Folds aged-out messages into the rolling summary using a cheap model.
 * Never throws — if the summarization call fails, the raw overflow text
 * is appended as-is so nothing is silently lost.
 */
async function foldIntoSummary(existingSummary, overflowMessages) {
  const overflowText = overflowMessages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  try {
    const prompt = `Existing conversation summary so far:\n${existingSummary || "(none yet)"}\n\nNew messages to fold in:\n${overflowText}\n\nWrite an updated, concise summary (under 200 words) that preserves the important facts, decisions, and open threads from both.`;

    const newSummary = await callOpenRouter({
      model: SUMMARY_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300,
      temperature: 0.2,
    });
    return newSummary.trim();
  } catch (err) {
    console.error("brainStore: summarization failed, appending raw overflow:", err.message);
    return `${existingSummary}\n[unsummarized]\n${overflowText}`.trim();
  }
}

function getContextForModel(sessionId) {
  const state = readState(sessionId);
  const summaryPreamble = state.chat_summary
    ? [{ role: "system", content: `Earlier conversation summary: ${state.chat_summary}` }]
    : [];
  const recent = state.recent_messages.map((m) => ({ role: m.role, content: m.content }));
  return [...summaryPreamble, ...recent];
}

module.exports = {
  DEFAULT_SESSION,
  readState,
  writeState,
  startTask,
  logDecision,
  logBlocker,
  markStepDone,
  appendMessage,
  getContextForModel,
  defaultState,
};
