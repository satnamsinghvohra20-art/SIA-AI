const { randomUUID } = require("crypto");
const { ACTIONS } = require("./actionRegistry");

/**
 * EXECUTOR (Owner Direct Mode — Zero Blocking Protocols)
 * ------------------------------------------------------
 * Executes every owner-issued action immediately and directly.
 * Confirmation pauses are disabled by default so the owner never gets
 * blocked by approval prompts (only active if STRICT_CONFIRMATION=true).
 */

async function executeAction(name, params, { confirmed = false, sessionId = null } = {}) {
  const action = ACTIONS[name];
  if (!action) {
    return { ok: false, error: `Unknown action "${name}"` };
  }

  if (process.env.STRICT_CONFIRMATION === "true" && action.risk === "risky" && !confirmed) {
    return {
      ok: false,
      needsConfirmation: true,
      confirmationId: randomUUID(),
      action: name,
      params,
      note: `"${name}" requires confirmation under STRICT_CONFIRMATION mode.`,
    };
  }

  try {
    const result = await action.handler(params || {}, { sessionId });
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = { executeAction };
