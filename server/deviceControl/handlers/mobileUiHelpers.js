const mobile = require("./mobile");

/**
 * MOBILE UI HELPERS
 * -----------------
 * Shared building block for any free, on-device automation flow (WhatsApp,
 * calls, Instagram): SiaAccessibilityService.readScreen() returns lines like
 *
 *   [980,2050] (tappable) Send
 *
 * — screen coordinates, whether it's tappable, then the label. This finds
 * a line whose label matches one of the given candidates and taps its
 * coordinates. Polls for a bit since the target app takes a moment to
 * open/render after open_url or open_app.
 */

const LINE_RE = /^\[(\d+),(\d+)\]\s*(\(tappable\)\s*)?(.*)$/;

function parseScreen(screenText) {
  return String(screenText || "")
    .split("\n")
    .map((line) => {
      const m = line.match(LINE_RE);
      if (!m) return null;
      return { x: Number(m[1]), y: Number(m[2]), tappable: Boolean(m[3]), label: m[4].trim() };
    })
    .filter(Boolean);
}

function findByLabel(elements, candidates) {
  const lowerCandidates = candidates.map((c) => c.toLowerCase());
  return elements.find((el) => lowerCandidates.some((c) => el.label.toLowerCase() === c))
    || elements.find((el) => lowerCandidates.some((c) => el.label.toLowerCase().includes(c)));
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Polls read_screen up to `attempts` times (spaced `intervalMs` apart)
 * until an element matching one of `labels` shows up, then returns it.
 * Throws a clear error (including what WAS on screen) if it never shows.
 */
async function waitForLabel(context, labels, { attempts = 6, intervalMs = 700 } = {}) {
  let lastScreenText = "";
  for (let i = 0; i < attempts; i++) {
    const { screen } = await mobile.readScreen({}, context);
    lastScreenText = screen;
    const elements = parseScreen(screen);
    const match = findByLabel(elements, labels);
    if (match) return match;
    await sleep(intervalMs);
  }
  throw new Error(
    `Waited for one of [${labels.join(", ")}] to appear on screen but it never did. ` +
      `What was actually visible: ${lastScreenText.slice(0, 400) || "(nothing readable)"}`
  );
}

async function tapLabel(context, labels, opts) {
  const match = await waitForLabel(context, labels, opts);
  await mobile.tap({ x: match.x, y: match.y }, context);
  return match;
}

module.exports = { parseScreen, findByLabel, waitForLabel, tapLabel, sleep };
