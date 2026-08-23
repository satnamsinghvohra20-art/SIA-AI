<<<<<<< HEAD
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
=======
/**
 * CALLS HANDLER
 * -------------
 * Places an outbound call via Twilio's Voice API and has it speak a
 * message using text-to-speech (TwiML <Say>). Official REST API, no
 * SIM/telephony hardware access needed.
 *
 * Setup (.env):
 *   TWILIO_ACCOUNT_SID=...
 *   TWILIO_AUTH_TOKEN=...
 *   TWILIO_CALLER_NUMBER=+1...   (a Twilio number you own)
 */

function assertConfigured() {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_CALLER_NUMBER } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_CALLER_NUMBER) {
    throw new Error(
      "Calling isn't configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and " +
        "TWILIO_CALLER_NUMBER in .env (see .env.example)."
    );
  }
  return { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_CALLER_NUMBER };
}

function escapeForXml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function placeCall({ to, message }) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_CALLER_NUMBER } = assertConfigured();
  if (!to || !message) throw new Error("to and message are required");

  const twiml = `<Response><Say voice="alice">${escapeForXml(message)}</Say></Response>`;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`;
  const body = new URLSearchParams({
    From: TWILIO_CALLER_NUMBER,
    To: to,
    Twiml: twiml,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Twilio call failed (${res.status}): ${data.message || JSON.stringify(data)}`);
  }
  return { to, sid: data.sid, status: data.status };
>>>>>>> 9422c3abfb40b468243a8ad777f3982b1242aa16
}

module.exports = { placeCall };
