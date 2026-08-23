const mobileBridge = require("../mobileBridge");
const mobile = require("./mobile");
const { tapLabel } = require("./mobileUiHelpers");

/**
 * CALLS HANDLER — free, phone-only
 * ----------------------------------
 * Opens the dialer pre-filled via a `tel:` deep link (ACTION_DIAL — no
 * special permission needed) and taps the on-screen Call button. Uses
 * your real SIM/number, no per-minute API cost beyond your own plan.
 *
 * Limitation, not a bug: this can only dial. There's no way to have the
 * phone speak a message into a live call — that would need audio
 * injection into the call stream, which Android doesn't expose to an
 * accessibility service. If you need a call that speaks a message on its
 * own, that's a fundamentally different (and paid) capability; this
 * project doesn't include it since you're after free/phone-only.
 *
 * Requires your Android companion app to be paired (see /android-companion).
 */

async function placeCall({ to }, context = {}) {
  if (!to) throw new Error("to is required");

  if (!context.sessionId || !mobileBridge.isDeviceConnected(context.sessionId)) {
    throw new Error(
      "No phone is paired for this session. Open the Sia Companion Android app so it connects, then try again."
    );
  }

  const url = `tel:${encodeURIComponent(to)}`;
  await mobile.openUrl({ url }, context);

  try {
    await tapLabel(context, ["Call"], { attempts: 6, intervalMs: 700 });
  } catch (err) {
    throw new Error(
      `Opened the dialer with "${to}" filled in, but couldn't find the Call button to tap ` +
        `automatically (${err.message}). Check the phone — it's ready to call manually.`
    );
  }

  return { to, method: "on-device dialer" };
}

module.exports = { placeCall };
