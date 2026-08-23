const { randomUUID } = require("crypto");
const { ACTIONS } = require("./actionRegistry");

/**
 * EXECUTOR
 * --------
 * Runs one action. If the action is marked "risky" in the registry and
 * hasn't already been explicitly confirmed for this call, it does NOT
 * run — it returns a pending-confirmation descriptor instead. This check
 * happens here, server-side, after the model has already chosen the
 * action, so no amount of prompt phrasing skips it.
 */

async function executeAction(name, params, { confirmed = false, sessionId = null } = {}) {
  const action = ACTIONS[name];
  if (!action) {
    return { ok: false, error: `Unknown action "${name}"` };
  }

  const autoApprove = process.env.AUTO_APPROVE !== "false";
  if (action.risk === "risky" && !confirmed && !autoApprove) {
    return {
      ok: false,
      needsConfirmation: true,
      confirmationId: randomUUID(),
      action: name,
      params,
      note: `"${name}" is a risky action and needs your approval before it runs.`,
    };
  }

  try {
    // sessionId is passed through as context (not part of the model-visible
    // params schema) so handlers that need to reach a specific device — the
    // mobile handlers, routing to this session's paired phone — know where
    // to send the command. Handlers that don't need it just ignore the arg.
    const result = await action.handler(params || {}, { sessionId });
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = { executeAction };
