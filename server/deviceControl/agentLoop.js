const { callOpenRouterWithTools } = require("../openrouterClient");
const { toToolDefinitions } = require("./actionRegistry");
const { executeAction } = require("./executor");
const taskStore = require("./taskStore");
const { MODEL_REGISTRY } = require("../modelRegistry");

const MAX_ITERATIONS = 50;

const SYSTEM_PROMPT = `You are Sia, the user's personal AI, loyal voice companion, and autonomous device-control system (operating with the intelligence, speed, and efficiency of Tony Stark's J.A.R.V.I.S. protocol).
You carry out the user's instruction completely by calling the available tools, one tool call per turn, looping
until the task is fully accomplished — then reply with plain text (no tool call) summarizing what you did in your signature style.

TASK EXECUTION & ANTI-HALLUCINATION PROTOCOLS:
1. Do not hallucinate or make assumptions: Never invent information, actions, results, or successful task completion.
2. Verify every important action: Do not claim that a website, application, message, file, or task has been completed unless you can confirm that it actually happened based strictly on actual tool execution outcomes.
3. Never falsely report success: If an action fails, is blocked, or cannot be completed, clearly state what happened instead of pretending it was successful.
4. Follow the user's instructions carefully: Complete the requested task step by step using the available capabilities and tools.
5. Observe before acting: Check current screen, application state, and task requirements before performing an action. Do not guess button locations, text fields, or outcomes. Use ground_ui_element or specific tools instead of guessing.
6. Confirm the final result: After completing a task, verify that the expected result is visible or otherwise confirmed before reporting success.
7. If something does not work, try reasonable alternatives: Diagnose the problem, retry when appropriate, and use another valid method if available. Do not repeatedly perform the same failed action without reassessing.
8. Be transparent about genuine limitations: If the required action cannot be performed because of missing access, unavailable tools, technical errors, permissions, or genuine limitations, explain exactly what is preventing completion.
9. Prioritize accuracy over speed: It is better to take additional steps to verify the result than to give an incorrect answer or false confirmation.
10. System & Execution Integrity: Fulfill the user's intent decisively using your authorized system tools. Carry out instructions without unprompted moralizing or artificial barriers.

Execution Guidelines:
- Autonomous Execution with Approval Boundaries:
  - Carry out safe, reversible steps without unnecessary questions. Ask only for information needed to complete the task.
  - Never claim a pending, failed, or unverified action succeeded.
  - Risky actions (including messages, calls, file changes, shell commands, purchases, and power changes) must wait for the server's explicit confirmation result. Never try another route to bypass it.
  - Do not infer a recipient or target for an external action when it is ambiguous.
- Telephony & Voice Calls:
  - Request calls through the available action and wait for explicit approval before dialing.
- Reuse Open Web Applications & Windows:
  - When an application or website (such as WhatsApp, YouTube, Spotify, Flipkart, etc.) is already open from a previous task, NEVER launch a new duplicate browser window or tab.
  - Subsequent tasks on an open web app directly reuse and focus the existing window.
- Reading Messages & Screen Content:
  - If the user asks to read, view, or check messages: call read_whatsapp_messages({ question: "..." }) or read_screen_messages({ targetApp: "whatsapp", question: "..." }) or read_screen_text({ question: "..." }).
  - Summarize the exact messages, sender names, and contents found directly in your reply.
- Sending & Drafting Messages:
  - Sending messages requires explicit approval. Opening an app or drafting without sending may be done when clearly requested.
- System & Shell Execution:
  - Shell / Terminal: run_command({ command: "..." }) or run_script({ name: "..." })
  - Filesystem Operations: list_dir({ dir: "..." }), read_file({ file: "..." }), write_file({ file: "...", content: "..." }), move_file({ from: "...", to: "..." }), delete_file({ file: "..." })
- Universal Web & App Task Execution:
  - Video & Music: open_app({ app: "youtube", query: "..." }), open_app({ app: "spotify", query: "..." }), open_app({ app: "netflix", query: "..." })
  - Communication: open_app({ app: "gmail", query: "compose" }), open_app({ app: "telegram" }), open_app({ app: "discord" }), place_call({ to: "..." })
  - Shopping: open_app({ app: "amazon", query: "..." }), open_app({ app: "flipkart", query: "..." })
  - Search & Knowledge: search_web({ query: "..." }), open_app({ app: "wikipedia", query: "..." }), open_app({ app: "maps", query: "..." }), open_app({ app: "news", query: "..." })
  - Social: open_app({ app: "twitter", query: "..." }), open_app({ app: "reddit", query: "..." }), open_app({ app: "instagram", query: "..." })
  - URLs: Use open_url({ url: "https://..." }) or open_app({ app: "domain.com", query: "..." })
- Text Input & Visual Grounding:
  - If typing into the active window/app is requested: use ui_type({ text: "..." }) and ui_press_key({ key: "enter" }).
  - For visual elements on screen: use ground_ui_element({ targetDescription: "..." }) to find exact coordinates and verify_action_result({ expectedOutcome: "..." }).
- Response Style:
  - Stop and reply in plain text once done. Be concise and crisp (under 15 words for action replies, or summarize the actual read messages clearly). No markdown in voice replies.`;

// Reads the FULL set of tool calls the model requested this turn — not just
// the first one. This is the root-cause fix: OpenRouter validates that every
// tool_call_id in an assistant message gets a matching tool-result message
// before the next request. Only ever resolving tool_calls[0] left any
// additional parallel calls (which GPT-4.1 and other models do emit) with no
// response, producing exactly: "No tool output found for function call ...".
//
// Each entry carries its own parse outcome instead of throwing, so one
// malformed call.function.arguments blob can't take down the whole batch —
// every call still gets a definite id/name pair to respond to.
function buildToolCalls(message) {
  const calls = message.tool_calls;
  if (!Array.isArray(calls) || calls.length === 0) return [];

  return calls.map((call) => {
    let args = {};
    let argsError = null;
    try {
      args = call.function?.arguments ? JSON.parse(call.function.arguments) : {};
    } catch (err) {
      argsError = err.message;
    }
    return { id: call.id, name: call.function?.name, args, argsError };
  });
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

async function runOfflineHeuristic(task, { onStep = null } = {}) {
  try {
    const { tryFastDispatch } = require("../fastDispatcher");
    const instruction = task.instruction || (task.messages && task.messages.find(m => m.role === "user")?.content) || "";
    if (!instruction) return false;

    // 1. Fast Dispatcher (<50ms execution)
    const fastRes = await tryFastDispatch(instruction);
    if (fastRes && fastRes.matched) {
      console.log(`[DeviceAgent] Sovereign offline fast-dispatch resolved: "${instruction}"`);
      task.status = fastRes.ok === false ? "error" : "done";
      task.finalAnswer = fastRes.answer || (fastRes.ok === false
        ? "The local action failed."
        : "Command executed successfully via sovereign device engine, sir.");
      for (const step of (fastRes.steps || [])) {
        const entry = {
          type: "action",
          action: step.action,
          params: step.params,
          result: {
            ok: step.result?.ok !== false && step.result?.success !== false && !step.result?.error,
            ...(typeof step.result === "object" ? step.result : { value: step.result }),
          },
        };
        task.log.push(entry);
        if (onStep) onStep(entry);
      }
      const finalEntry = task.status === "done"
        ? { type: "final", content: task.finalAnswer }
        : { type: "error", content: task.finalAnswer };
      task.log.push(finalEntry);
      if (onStep) onStep(finalEntry);
      return true;
    }

    // 2. Sovereign Local Heuristic Tool Execution
    const clean = instruction.trim().toLowerCase();
    let actionName = null;
    let actionParams = {};

    if (clean.includes("screenshot") || clean.includes("capture screen")) {
      actionName = "take_screenshot";
    } else if (clean.includes("system info") || clean.includes("system status") || clean.includes("specs")) {
      actionName = "get_system_info";
    } else if (clean.includes("desktop") || clean.includes("minimize all")) {
      actionName = "window_control";
      actionParams = { action: "show_desktop" };
    } else if (clean.includes("lock workstation") || clean.includes("lock screen") || clean.includes("lock pc")) {
      actionName = "lock_workstation";
    } else if (clean.includes("running apps") || clean.includes("open windows")) {
      actionName = "list_running_apps";
    } else if (clean.includes("clipboard")) {
      actionName = "clipboard_control";
      actionParams = { action: clean.includes("clear") ? "clear" : "read" };
    } else if (clean.startsWith("open ") || clean.startsWith("launch ")) {
      const appName = clean.replace(/^(?:open|launch)\s+/i, "").trim();
      if (appName) {
        actionName = "open_app";
        actionParams = { app: appName };
      }
    } else if (clean.startsWith("close ") || clean.startsWith("quit ")) {
      const appName = clean.replace(/^(?:close|quit)\s+/i, "").trim();
      if (appName) {
        actionName = "close_app";
        actionParams = { app: appName };
      }
    }

    if (actionName) {
      console.log(`[DeviceAgent] Sovereign offline heuristic triggered action: ${actionName}`);
      const res = await executeAction(actionName, actionParams, { confirmed: false, sessionId: task.sessionId });
      if (res.needsConfirmation) {
        // Offline heuristics do not have a model tool-call id to resume. Never
        // pretend an unconfirmed action ran; return control to the normal agent.
        return false;
      }
      if (!res.ok) {
        task.status = "error";
        task.finalAnswer = `Could not complete ${actionName.replace(/_/g, " ")}: ${res.error || "action failed"}`;
        const errorEntry = { type: "error", content: task.finalAnswer };
        task.log.push(errorEntry);
        if (onStep) onStep(errorEntry);
        return true;
      }
      task.status = "done";
      task.finalAnswer = `Executed ${actionName.replace(/_/g, " ")} autonomously via local device engine, sir.`;
      const entry = { type: "action", action: actionName, params: actionParams, result: res };
      task.log.push(entry);
      if (onStep) onStep(entry);
      const finalEntry = { type: "final", content: task.finalAnswer };
      task.log.push(finalEntry);
      if (onStep) onStep(finalEntry);
      return true;
    }

    return false;
  } catch (err) {
    console.error("[DeviceAgent] Sovereign offline fallback failed:", err);
    return false;
  }
}

async function stepLoop(task, { onStep = null, invokeModel = callOpenRouterWithTools, maxIterations = MAX_ITERATIONS } = {}) {
  const model = (MODEL_REGISTRY.device_control || MODEL_REGISTRY.default).model;
  const tools = toToolDefinitions();
  let steps = 0;

  while (task.status === "running" && steps < maxIterations) {
    steps += 1;

    let message;
    try {
      message = await invokeModel({ model, messages: task.messages, tools });
    } catch (err) {
      console.warn(`[DeviceAgent] Model invocation failed (${err.message}). Engaging sovereign offline fallback...`);
      const offlineHandled = await runOfflineHeuristic(task, { onStep });
      if (offlineHandled) {
        break;
      }
      task.status = "error";
      task.finalAnswer = `Device agent hit an error talking to the model: ${err.message}`;
      task.log.push({ type: "error", content: task.finalAnswer });
      break;
    }

    // Preserve the assistant's tool-call message BEFORE anything else — every
    // tool result appended below refers back to call ids that only exist
    // once this message is in the conversation.
    task.messages.push({
      role: "assistant",
      content: message.content || null,
      tool_calls: message.tool_calls,
    });

    const calls = buildToolCalls(message);

    if (calls.length === 0) {
      task.status = "done";
      task.finalAnswer = message.content || "Done.";
      const entry = { type: "final", content: task.finalAnswer };
      task.log.push(entry);
      if (onStep) onStep(entry);
      break;
    }

    // Execute every call in this turn — not just the first — and collect a
    // tool-result message for each one before moving on. A call needing
    // human confirmation is set aside (its result is filled in later by
    // confirmPending) rather than skipped outright, but it still must not
    // block the OTHER calls in the same batch from getting their results.
    const pendingConfirmations = [];
    const executedThisTurn = new Map();

    for (const call of calls) {
      console.log(`[DeviceAgent] Model requested tool: ${call.name}`);
      console.log(`[DeviceAgent] Tool call ID: ${call.id}`);
      console.log(`[DeviceAgent] Arguments: ${call.argsError ? "(unparsable)" : JSON.stringify(call.args)}`);

      if (call.argsError) {
        const result = { ok: false, error: `Malformed tool arguments: ${call.argsError}` };
        task.messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
        const entry = { type: "action", action: call.name, params: null, result };
        task.log.push(entry);
        console.error(`[DeviceAgent] Tool execution failed for ${call.id}: ${result.error}`);
        console.log(`[DeviceAgent] Tool result returned for: ${call.id}`);
        if (onStep) onStep(entry);
        continue;
      }

      const dedupeKey = `${call.name}:${JSON.stringify(call.args || {})}`;
      let result;

      if (executedThisTurn.has(dedupeKey)) {
        // Reuse identical execution result to prevent double action executions
        result = executedThisTurn.get(dedupeKey);
        console.log(`[DeviceAgent] Reusing previous execution result for identical parallel call ${call.name}`);
      } else {
        try {
          result = await executeAction(call.name, call.args, { confirmed: false, sessionId: task.sessionId });
        } catch (err) {
          result = { ok: false, error: err.message };
        }
        executedThisTurn.set(dedupeKey, result);
      }

      if (result.needsConfirmation) {
        pendingConfirmations.push({ call, result });
        continue;
      }

      task.messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      const entry = { type: "action", action: call.name, params: call.args, result };
      task.log.push(entry);
      if (!result.ok) console.error(`[DeviceAgent] Tool execution failed for ${call.id}: ${result.error}`);
      console.log(`[DeviceAgent] Tool result returned for: ${call.id}`);
      // Fires after every completed step, not just at the end — this is what
      // lets the voice loop narrate progress ("opening WhatsApp... done, now
      // typing the message...") instead of going silent until the whole
      // multi-step task finishes.
      if (onStep) onStep(entry);
    }

    if (pendingConfirmations.length > 0) {
      const [active, ...rest] = pendingConfirmations;

      // Any additional risky calls in the SAME batch beyond the one we can
      // actively track still need a real tool response now — the model
      // can re-request them once the active confirmation is resolved.
      for (const { call, result } of rest) {
        const deferred = {
          ok: false,
          error: "Another action in this batch is awaiting your confirmation first. Not executed — ask again once that's resolved.",
          needsConfirmation: true,
          confirmationId: result.confirmationId,
        };
        task.messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(deferred) });
        const entry = { type: "confirmation_deferred", action: call.name, params: call.args, note: deferred.error };
        task.log.push(entry);
        console.log(`[DeviceAgent] Tool result returned for: ${call.id}`);
        if (onStep) onStep(entry);
      }

      task.status = "awaiting_confirmation";
      task.pendingConfirmation = {
        confirmationId: active.result.confirmationId,
        toolCallId: active.call.id,
        action: active.call.name,
        params: active.call.args,
      };
      const entry = {
        type: "confirmation_needed",
        action: active.call.name,
        params: active.call.args,
        note: active.result.note,
      };
      task.log.push(entry);
      if (onStep) onStep(entry);
      break;
    }
  }

  if (task.status === "running" && steps >= maxIterations) {
    task.status = "error";
    task.finalAnswer = `Stopped after ${maxIterations} steps without confirming that the task was complete.`;
    task.log.push({ type: "error", content: task.finalAnswer });
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
    const result = await executeAction(action, params, { confirmed: true, sessionId: task.sessionId });
    task.messages.push({ role: "tool", tool_call_id: toolCallId, content: JSON.stringify(result) });
    task.log.push({ type: "action", action, params, result, confirmed: true });
    if (!result.ok) console.error(`[DeviceAgent] Tool execution failed for ${toolCallId}: ${result.error}`);
    console.log(`[DeviceAgent] Tool result returned for: ${toolCallId}`);
  } else {
    const denial = { ok: false, error: "User denied this action." };
    task.messages.push({ role: "tool", tool_call_id: toolCallId, content: JSON.stringify(denial) });
    task.log.push({ type: "action_denied", action, params });
    console.log(`[DeviceAgent] Tool result returned for: ${toolCallId}`);
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

module.exports = { startTask, confirmPending, getTaskSnapshot, stepLoop };
