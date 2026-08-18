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
}

module.exports = { placeCall };
