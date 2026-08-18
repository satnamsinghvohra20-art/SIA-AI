const { randomUUID } = require("crypto");

/**
 * TASK STORE
 * ----------
 * In-memory (per-process) store of device-control agent tasks. A task is
 * a resumable loop: it holds the full tool-calling conversation so a
 * paused-for-confirmation task can pick back up exactly where it left off.
 *
 * In-memory means tasks don't survive a server restart and don't share
 * state across multiple instances — fine for a single-process personal
 * deployment (the same tier this whole project is currently at per
 * FEATURES.md), not for horizontal scaling. If you outgrow that, swap
 * this for a Redis/DB-backed store without changing agentLoop.js's API.
 */

const tasks = new Map();

function createTask(sessionId, instruction) {
  const id = randomUUID();
  const task = {
    id,
    sessionId,
    instruction,
    status: "running", // running | awaiting_confirmation | done | error
    log: [],
    messages: [],
    pendingConfirmation: null,
    createdAt: Date.now(),
  };
  tasks.set(id, task);
  return task;
}

function getTask(id, sessionId) {
  const task = tasks.get(id);
  if (!task || task.sessionId !== sessionId) return null;
  return task;
}

function pruneOldTasks(maxAgeMs = 1000 * 60 * 60) {
  const cutoff = Date.now() - maxAgeMs;
  for (const [id, task] of tasks) {
    if (task.createdAt < cutoff && task.status !== "running") tasks.delete(id);
  }
}

module.exports = { createTask, getTask, pruneOldTasks };
