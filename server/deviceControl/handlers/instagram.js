/**
 * INSTAGRAM HANDLER
 * -----------------
 * Uses Meta's official Instagram Messaging API (Graph API), the only
 * supported way to send Instagram DMs programmatically. There is no
 * "personal account" path here on purpose: unofficial personal-account
 * automation (scripted login, private-API scraping) routinely gets
 * accounts banned and isn't something this project builds.
 *
 * Requirements (Meta's platform rules, not this code's):
 *   - An Instagram professional (Business/Creator) account linked to a
 *     Facebook Page
 *   - A Meta app with instagram_manage_messages permission + a page access token
 *   - The recipient must have messaged your account within the last 24h
 *     (the standard messaging window), unless you're using an approved
 *     message tag
 *
 * Setup (.env): INSTAGRAM_PAGE_ACCESS_TOKEN, INSTAGRAM_BUSINESS_ACCOUNT_ID
 */

function assertConfigured() {
  const { INSTAGRAM_PAGE_ACCESS_TOKEN, INSTAGRAM_BUSINESS_ACCOUNT_ID } = process.env;
  if (!INSTAGRAM_PAGE_ACCESS_TOKEN || !INSTAGRAM_BUSINESS_ACCOUNT_ID) {
    throw new Error(
      "Instagram isn't configured. Set INSTAGRAM_PAGE_ACCESS_TOKEN and " +
        "INSTAGRAM_BUSINESS_ACCOUNT_ID in .env — these come from a Meta app with " +
        "the Instagram Messaging API enabled on a Business/Creator account. " +
        "There is no supported way to automate a personal Instagram account; " +
        "this action intentionally won't try to."
    );
  }
  return { INSTAGRAM_PAGE_ACCESS_TOKEN, INSTAGRAM_BUSINESS_ACCOUNT_ID };
}

async function sendInstagramMessage({ recipientId, message }) {
  const { INSTAGRAM_PAGE_ACCESS_TOKEN, INSTAGRAM_BUSINESS_ACCOUNT_ID } = assertConfigured();
  if (!recipientId || !message) throw new Error("recipientId and message are required");

  const url = `https://graph.facebook.com/v21.0/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/messages?access_token=${encodeURIComponent(
    INSTAGRAM_PAGE_ACCESS_TOKEN
  )}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text: message },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Instagram send failed (${res.status}): ${data.error?.message || JSON.stringify(data)}`);
  }
  return { recipientId, messageId: data.message_id };
}

module.exports = { sendInstagramMessage };
