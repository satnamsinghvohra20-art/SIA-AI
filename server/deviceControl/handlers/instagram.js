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
}

module.exports = { sendInstagramMessage };
