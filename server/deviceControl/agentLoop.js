const { callOpenRouterWithTools } = require("../openrouterClient");
const { toToolDefinitions } = require("./actionRegistry");
const { executeAction } = require("./executor");
const taskStore = require("./taskStore");
const { MODEL_REGISTRY } = require("../modelRegistry");

const MAX_STEPS = 8;

const SYSTEM_PROMPT = `You are Sia's device-control agent. You carry out ONE user
instruction by calling the available tools, one tool call per turn, looping
until the instruction is fully done — then reply with plain text (no tool
call) summarizing what you did.

Rules:
- Call exactly one tool per turn. Look at the result before deciding the next step.
- Some tools are risky (deleting files, sending messages, placing calls, power
  actions, running scripts) and will pause for human approval — that's expected
  and not an error; just wait for the result and continue from there.
- If a tool call fails, read the error and either try a corrected call or explain
  the problem in your final text reply — don't repeat the same failing call.
- If the instruction is ambiguous or you're missing a required piece of
  information (e.g. no phone number given for a message), say so in a plain
  text reply instead of guessing.
- Stop and reply in plain text once the instruction is actually complete.`;

function buildToolCall(message) {
  const call = message.tool_calls?.[0];
  if (!call) return null;
  let args = {};
  try {
    args = call.function?.arguments ? JSON.parse(call.function.arguments) : {};
  } catch {
    args = {};
  }
  return { id: call.id, name: call.function?.name, args };
}

function snapshot(task) {
  return {
    taskId: task.id,
    status: task.status,
    log: task.log,
    finalAnswer: task.finalAnswer || null,
    pendingConfirmation: task.pendingConfirmation
      ? {
          confirmationId: task.pendingConfirmation.confirmationId,
          action: task.pendingConfirmation.action,
          params: task.pendingConfirmation.params,
        }
      : null,
  };
}

async function stepLoop(task, { onStep = null } = {}) {
  const model = (MODEL_REGISTRY.device_control || MODEL_REGISTRY.default).model;
  const tools = toToolDefinitions();
  let steps = 0;

  while (task.status === "running" && steps < MAX_STEPS) {
    steps += 1;

    let message;
    try {
      message = await callOpenRouterWithTools({ model, messages: task.messages, tools });
    } catch (err) {
      task.status = "error";
      task.finalAnswer = `Device agent hit an error talking to the model: ${err.message}`;
      task.log.push({ type: "error", content: task.finalAnswer });
      break;
    }

    task.messages.push({
      role: "assistant",
      content: message.content || null,
      tool_calls: message.tool_calls,
    });

    const call = buildToolCall(message);
    if (!call) {
      task.status = "done";
      task.finalAnswer = message.content || "Done.";
      const entry = { type: "final", content: task.finalAnswer };
      task.log.push(entry);
      if (onStep) onStep(entry);
      break;
    }

    const result = await executeAction(call.name, call.args, { confirmed: false, sessionId: task.sessionId });

    if (result.needsConfirmation) {
      task.status = "awaiting_confirmation";
      task.pendingConfirmation = {
        confirmationId: result.confirmationId,
        toolCallId: call.id,
        action: call.name,
        params: call.args,
      };
      const entry = { type: "confirmation_needed", action: call.name, params: call.args, note: result.note };
      task.log.push(entry);
      if (onStep) onStep(entry);
      break;
    }

    task.messages.push({
      role: "tool",
      tool_call_id: call.id,
      content: JSON.stringify(result),
    });
    const entry = { type: "action", action: call.name, params: call.args, result };
    task.log.push(entry);
    // Fires after every completed step, not just at the end — this is what
    // lets the voice loop narrate progress ("opening WhatsApp... done, now
    // typing the message...") instead of going silent until the whole
    // multi-step task finishes.
    if (onStep) onStep(entry);
  }

  if (task.status === "running" && steps >= MAX_STEPS) {
    task.status = "done";
    task.finalAnswer = "Stopped after reaching the step limit for this task (8 actions). Ask again to continue.";
    task.log.push({ type: "final", content: task.finalAnswer });
  }

  return snapshot(task);
}

async function startTask({ sessionId, instruction, onStep = null }) {
  const task = taskStore.createTask(sessionId, instruction);
  task.messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: instruction },
  ];
  return stepLoop(task, { onStep });
}

async function confirmPending({ sessionId, taskId, confirmationId, approved, onStep = null }) {
  const task = taskStore.getTask(taskId, sessionId);
  if (!task) return { error: "Task not found." };
  if (task.status !== "awaiting_confirmation" || !task.pendingConfirmation) {
    return { error: "This task isn't waiting on a confirmation." };
  }
  if (task.pendingConfirmation.confirmationId !== confirmationId) {
    return { error: "Confirmation id doesn't match the pending action." };
  }

  const { toolCallId, action, params } = task.pendingConfirmation;

  if (approved) {
    const result = await executeAction(action, params, { confirmed: true });
    task.messages.push({ role: "tool", tool_call_id: toolCallId, content: JSON.stringify(result) });
    task.log.push({ type: "action", action, params, result, confirmed: true });
  } else {
    const denial = { ok: false, error: "User denied this action." };
    task.messages.push({ role: "tool", tool_call_id: toolCallId, content: JSON.stringify(denial) });
    task.log.push({ type: "action_denied", action, params });
  }

  task.pendingConfirmation = null;
  task.status = "running";
  return stepLoop(task, { onStep });
}

function getTaskSnapshot(sessionId, taskId) {
  const task = taskStore.getTask(taskId, sessionId);
  if (!task) return null;
  return snapshot(task);
}

module.exports = { startTask, confirmPending, getTaskSnapshot };
