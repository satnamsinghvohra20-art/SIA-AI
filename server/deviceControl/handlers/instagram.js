<<<<<<< HEAD
const mobileBridge = require("../mobileBridge");
const mobile = require("./mobile");
const { tapLabel } = require("./mobileUiHelpers");

/**
 * INSTAGRAM HANDLER — free, phone-only
 * ---------------------------------------
 * Opens the profile, taps Message, taps the compose field, types, taps
 * Send — all on your paired phone, your real account, no tokens, no API.
 *
 * Be aware this one is more fragile than WhatsApp's: Instagram has no
 * documented link that pre-fills a DM to an arbitrary username the way
 * wa.me does for WhatsApp, so this is stepping through the real UI by
 * label-matching each screen. If Instagram changes their layout, or your
 * account is in a state that shows an extra dialog, a step can fail —
 * when that happens you'll get a clear error telling you what to check on
 * the phone rather than it failing silently.
 *
 * Requires your Android companion app to be paired (see /android-companion).
 */

async function sendInstagramMessage({ username, message }, context = {}) {
  if (!username) throw new Error("username is required");
  if (!message) throw new Error("message is required");

  const instaUrl = `https://www.instagram.com/${encodeURIComponent(username)}/`;

  if (!context.sessionId || !mobileBridge.isDeviceConnected(context.sessionId)) {
    const system = require("./system");
    await system.openUrl({ url: instaUrl, browser: "edge" });
    return {
      username,
      message,
      method: "Microsoft Edge (Instagram Web)",
      note: `No phone paired; opened ${username}'s Instagram profile in Edge.`,
    };
  }

  await mobile.openUrl({ url: instaUrl }, context);

  try {
    await tapLabel(context, ["Message"], { attempts: 8, intervalMs: 800 });
  } catch (err) {
    throw new Error(
      `Opened ${username}'s profile but couldn't find the "Message" button (${err.message}). ` +
        `Check the phone — the profile is open, ready to message manually.`
    );
  }

  // Some Instagram versions land you in the compose field already focused
  // after tapping "Message" on the profile; tapping the placeholder text
  // again if present is harmless and helps on versions that don't.
  try {
    await tapLabel(context, ["Message...", "Message"], { attempts: 4, intervalMs: 600 });
  } catch {
    // not fatal — proceed to typing regardless
  }

  await mobile.typeText({ text: message }, context);

  try {
    await tapLabel(context, ["Send"], { attempts: 4, intervalMs: 600 });
  } catch (err) {
    throw new Error(
      `Typed the message to ${username} but couldn't find the Send button to tap automatically ` +
        `(${err.message}). Check the phone — the message is drafted and ready to send manually.`
    );
  }

  return { username, message, method: "on-device Instagram" };
=======
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
>>>>>>> 9422c3abfb40b468243a8ad777f3982b1242aa16
}

module.exports = { sendInstagramMessage };
