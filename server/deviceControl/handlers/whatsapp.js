/**
 * WHATSAPP HANDLER
 * ----------------
 * Sends via Twilio's WhatsApp Business API (official, HTTP-only — no
 * headless browser, no QR-code session to babysit, no risk of your
 * personal WhatsApp account getting banned for automation, which is the
 * real failure mode of unofficial "whatsapp-web.js"-style libraries).
 *
 * Setup (all in .env):
 *   TWILIO_ACCOUNT_SID=...
 *   TWILIO_AUTH_TOKEN=...
 *   TWILIO_WHATSAPP_FROM=whatsapp:+14155238886   (Twilio sandbox or your approved sender)
 *
 * The recipient must have opted in to your Twilio WhatsApp sender (join
 * your sandbox, or be a contact of an approved business number) — that's
 * a WhatsApp platform rule, not something this code can route around.
 */

function assertConfigured() {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
    throw new Error(
      "WhatsApp isn't configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and " +
        "TWILIO_WHATSAPP_FROM in .env (see .env.example)."
    );
  }
  return { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM };
}

async function sendWhatsappMessage({ to, message }) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM } = assertConfigured();
  if (!to || !message) throw new Error("to and message are required");

  const toAddr = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const body = new URLSearchParams({
    From: TWILIO_WHATSAPP_FROM,
    To: toAddr,
    Body: message,
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
    throw new Error(`Twilio WhatsApp send failed (${res.status}): ${data.message || JSON.stringify(data)}`);
  }
  return { to, sid: data.sid, status: data.status };
}

module.exports = { sendWhatsappMessage };
