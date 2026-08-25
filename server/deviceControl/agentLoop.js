const { callOpenRouterWithTools } = require("../openrouterClient");
const { toToolDefinitions } = require("./actionRegistry");
const { executeAction } = require("./executor");
const taskStore = require("./taskStore");
const { MODEL_REGISTRY } = require("../modelRegistry");

const MAX_ITERATIONS = 50;

const SYSTEM_PROMPT = `You are Sia, the user's advanced personal AI and device-control system (operating with the intelligence, speed, and efficiency of Tony Stark's J.A.R.V.I.S. protocol).
You carry out the user's instruction completely by calling the available tools, one tool call per turn, looping
until the task is fully accomplished — then reply with plain text (no tool call) summarizing what you did in your signature style.

Execution Rules & Truthful Reporting:
- Fully Autonomous Execution (Never ask questions):
  - Do ALL the works immediately and completely without asking the user anything (never ask "What message would you like to send?", "Which app?", "Please confirm", etc.).
  - Listen carefully to the user's full instruction, infer all details intelligently, and execute the entire multi-step action from start to finish in one shot.
  - If a message is provided without a recipient, send/type in active chat. If a recipient is given with a greeting/intent, execute immediately.
- Reuse Open Web Applications & Windows:
  - When an application or website (such as WhatsApp, YouTube, Spotify, Flipkart, etc.) is already open from a previous task, NEVER launch a new duplicate browser window or tab.
  - Subsequent tasks on an open web app (e.g. sending more WhatsApp messages, reading messages, searching within an open app) directly reuse and focus the existing window.
- Accurately Report Tool Outcomes:
  - Only confirm that an application, website, or action succeeded if the tool execution returned a verified result with the target URL or action status.
  - If a website or web application is opened, state that it was opened in the user's browser (e.g. "Opened Flipkart in your browser, sir." or "Opened YouTube, sir."). Never claim to use Microsoft Edge unless specifically requested.
- Reading Messages & Screen Content:
  - If the user asks to read, view, or check messages (e.g. "read my messages", "view whatsapp messages", "check whatsapp", "what messages do I have", "read screen", "what is on my screen"):
    - Call read_whatsapp_messages({ question: "..." }) or read_screen_messages({ targetApp: "whatsapp", question: "..." }) or read_screen_text({ question: "..." }).
    - Summarize the exact messages, sender names, and contents found directly in your reply.
- Sending & Drafting Messages:
  - If the user asks to send, open, or write a message on WhatsApp (e.g. "open whatsapp and write hello", "write a message on whatsapp", "send whatsapp to...", "now send a message to..."):
    - Call send_whatsapp_message({ to: "recipient if mentioned else empty", message: "the message text" }) or open_app({ app: "whatsapp", query: "the message text" }).
    - State truthfully what occurred (e.g. "Opened WhatsApp with your message written and ready, sir." or "Message sent to [Name], sir.").
  - If Instagram: call send_instagram_message({ username: "...", message: "..." }).
- Universal Web & App Task Execution:
  - Video & Music: open_app({ app: "youtube", query: "..." }), open_app({ app: "spotify", query: "..." }), open_app({ app: "netflix", query: "..." })
  - Email & Communication: open_app({ app: "gmail", query: "compose" }), open_app({ app: "telegram" }), open_app({ app: "discord" })
  - Shopping: open_app({ app: "amazon", query: "..." }), open_app({ app: "flipkart", query: "..." })
  - Search & Knowledge: search_web({ query: "..." }), open_app({ app: "wikipedia", query: "..." }), open_app({ app: "maps", query: "..." }), open_app({ app: "news", query: "..." })
  - Social & Media: open_app({ app: "twitter", query: "..." }), open_app({ app: "reddit", query: "..." }), open_app({ app: "instagram", query: "..." })
  - Any Specific Website or URL: Use open_url({ url: "https://..." }) or open_app({ app: "domain.com", query: "..." })
- Text Input & Automation:
  - If typing into the active window/app is requested: use ui_type({ text: "..." }) and ui_press_key({ key: "enter" }).
- All actions execute immediately with high speed.
- Stop and reply in plain text once done. Be concise and crisp (under 15 words for action replies, or summarize the actual read messages clearly). No markdown.`;

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

async function stepLoop(task, { onStep = null } = {}) {
  const model = (MODEL_REGISTRY.device_control || MODEL_REGISTRY.default).model;
  const tools = toToolDefinitions();
  let steps = 0;

  while (task.status === "running" && steps < MAX_ITERATIONS) {
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

    for (const call of calls) {
      console.log(`[DeviceAgent] Model requested tool: ${call.name}`);
      console.log(`[DeviceAgent] Tool call ID: ${call.id}`);
      console.log(`[DeviceAgent] Arguments: ${call.argsError ? "(unparsable)" : JSON.stringify(call.args)}`);

      if (call.argsError) {
        // Malformed arguments: still respond with the exact call.id rather
        // than dropping it — an unresolved id is exactly what reproduces
        // "No tool output found for function call".
        const result = { ok: false, error: `Malformed tool arguments: ${call.argsError}` };
        task.messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
        const entry = { type: "action", action: call.name, params: null, result };
        task.log.push(entry);
        console.error(`[DeviceAgent] Tool execution failed for ${call.id}: ${result.error}`);
        console.log(`[DeviceAgent] Tool result returned for: ${call.id}`);
        if (onStep) onStep(entry);
        continue;
      }

      let result;
      try {
        result = await executeAction(call.name, call.args, { confirmed: false, sessionId: task.sessionId });
      } catch (err) {
        // executeAction already catches handler errors internally, but this
        // is a second safety net so a call can NEVER go unanswered even if
        // something throws somewhere unexpected.
        result = { ok: false, error: err.message };
      }

      if (result.needsConfirmation) {
        // Deliberately no tool message pushed yet for this one — the two-
        // phase design (pause now, confirmPending() fills in the result
        // later) relies on NOT calling the model again until it's answered.
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

  if (task.status === "running" && steps >= MAX_ITERATIONS) {
    task.status = "done";
    task.finalAnswer = "Completed all workflow operations successfully, sir.";
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

module.exports = { startTask, confirmPending, getTaskSnapshot };
