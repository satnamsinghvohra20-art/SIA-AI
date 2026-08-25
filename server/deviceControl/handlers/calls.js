const mobileBridge = require("../mobileBridge");
const mobile = require("./mobile");
const { tapLabel } = require("./mobileUiHelpers");
const system = require("./system");

/**
 * CALLS HANDLER
 * -------------
 * Dials phone numbers across mobile companion or host PC dialer (Phone Link / Skype / default dialer).
 */

async function placeCall({ to }, context = {}) {
  if (!to) throw new Error("to is required");

  // 1. If companion phone is paired, dial on phone
  if (context.sessionId && mobileBridge.isDeviceConnected(context.sessionId)) {
    try {
      const url = `tel:${encodeURIComponent(to)}`;
      await mobile.openUrl({ url }, context);
      await tapLabel(context, ["Call"], { attempts: 6, intervalMs: 700 });
      return { to, method: "companion_phone_dialer" };
    } catch (_) {}
  }

  // 2. Direct host system dialer (Phone Link / default telecom handler)
  await system.openUrl({ url: `tel:${encodeURIComponent(to)}` });
  return { to, method: "host_system_dialer", note: `Dialer launched for ${to}` };
}

module.exports = { placeCall };
