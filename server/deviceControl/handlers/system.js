const { execFile } = require("child_process");
const os = require("os");
const path = require("path");
const fs = require("fs/promises");

/**
 * SYSTEM HANDLERS
 * ---------------
 * Controls the machine Sia's server process is running on: launch/close
 * apps, volume, power state, screenshots.
 *
 * Every function here shells out via `execFile` (never `exec`) so
 * arguments are passed as an array and never interpolated into a shell
 * string — that's what keeps this from becoming an injection vector.
 * Nothing here accepts a raw shell command; see scripts.js for the
 * (whitelisted, confirmation-gated) escape hatch for that.
 */

const PLATFORM = os.platform(); // 'win32' | 'darwin' | 'linux'

// Friendly app name -> platform-specific launch target. Extend this map
// rather than allowing arbitrary executable paths, so "open app" can't be
// used to launch something unexpected.
const APP_MAP = {
  win32: {
    chrome: "chrome",
    browser: "chrome",
    notepad: "notepad",
    calculator: "calc",
    explorer: "explorer",
    "file explorer": "explorer",
    word: "winword",
    excel: "excel",
    spotify: "spotify",
    settings: "start ms-settings:",
  },
  darwin: {
    chrome: "Google Chrome",
    browser: "Safari",
    safari: "Safari",
    notes: "Notes",
    calculator: "Calculator",
    finder: "Finder",
    "file explorer": "Finder",
    word: "Microsoft Word",
    excel: "Microsoft Excel",
    spotify: "Spotify",
    settings: "System Settings",
  },
  linux: {
    chrome: "google-chrome",
    browser: "xdg-open",
    notepad: "gedit",
    calculator: "gnome-calculator",
    "file explorer": "xdg-open",
    spotify: "spotify",
    terminal: "x-terminal-emulator",
  },
};

function resolveApp(appName) {
  const table = APP_MAP[PLATFORM] || {};
  const key = String(appName || "").trim().toLowerCase();
  return table[key] || null;
}

function run(cmd, args = []) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 10_000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr?.toString() || err.message));
      resolve(stdout?.toString().trim() || "");
    });
  });
}

async function openApp({ app }) {
  const target = resolveApp(app);
  if (!target) {
    const known = Object.keys(APP_MAP[PLATFORM] || {}).join(", ");
    throw new Error(
      `"${app}" isn't in the known app list for this OS. Known apps: ${known}. ` +
        `Add it to APP_MAP in server/deviceControl/handlers/system.js to support more.`
    );
  }

  if (PLATFORM === "darwin") {
    await run("open", ["-a", target]);
  } else if (PLATFORM === "win32") {
    await run("cmd.exe", ["/c", "start", "", target]);
  } else {
    await run(target, []);
  }
  return { opened: app };
}

async function closeApp({ app }) {
  const target = resolveApp(app) || app;
  if (PLATFORM === "win32") {
    await run("taskkill", ["/IM", `${target}.exe`, "/F"]).catch(() => {
      // taskkill exits non-zero if the process wasn't running — not fatal
    });
  } else {
    await run("pkill", ["-if", target]).catch(() => {});
  }
  return { closed: app };
}

async function setVolume({ level }) {
  const pct = Math.max(0, Math.min(100, Number(level)));
  if (Number.isNaN(pct)) throw new Error("level must be a number 0-100");

  if (PLATFORM === "darwin") {
    await run("osascript", ["-e", `set volume output volume ${pct}`]);
  } else if (PLATFORM === "linux") {
    await run("amixer", ["-D", "pulse", "sset", "Master", `${pct}%`]);
  } else if (PLATFORM === "win32") {
    // Windows has no volume CLI out of the box; nircmd.exe (user-supplied,
    // placed on PATH) is the standard workaround.
    await run("nircmd.exe", ["setsysvolume", String(Math.round((pct / 100) * 65535))]);
  }
  return { volume: pct };
}

async function systemPower({ action }) {
  const a = String(action || "").toLowerCase();
  if (!["shutdown", "restart", "sleep"].includes(a)) {
    throw new Error("action must be one of: shutdown, restart, sleep");
  }

  if (PLATFORM === "win32") {
    const map = { shutdown: ["/s", "/t", "5"], restart: ["/r", "/t", "5"], sleep: null };
    if (a === "sleep") {
      await run("rundll32.exe", ["powrprof.dll,SetSuspendState", "0,1,0"]);
    } else {
      await run("shutdown", map[a]);
    }
  } else if (PLATFORM === "darwin") {
    const map = {
      shutdown: ["-e", 'tell app "System Events" to shut down'],
      restart: ["-e", 'tell app "System Events" to restart'],
      sleep: ["-e", 'tell app "System Events" to sleep'],
    };
    await run("osascript", map[a]);
  } else {
    const map = { shutdown: ["poweroff"], restart: ["reboot"], sleep: ["systemctl", "suspend"] };
    const [bin, ...rest] = map[a];
    await run(bin, rest);
  }
  return { power: a };
}

async function takeScreenshot() {
  const outDir = path.join(__dirname, "..", "..", "..", "data", "device", "screenshots");
  await fs.mkdir(outDir, { recursive: true });
  const file = path.join(outDir, `screenshot-${Date.now()}.png`);

  if (PLATFORM === "darwin") {
    await run("screencapture", ["-x", file]);
  } else if (PLATFORM === "win32") {
    // No single built-in CLI for this on Windows; nircmd is the common shim.
    await run("nircmd.exe", ["savescreenshot", file]);
  } else {
    await run("import", ["-window", "root", file]); // ImageMagick, common on Linux desktops
  }
  return { screenshot: file };
}

async function getSystemInfo() {
  return {
    platform: PLATFORM,
    hostname: os.hostname(),
    uptimeSeconds: Math.round(os.uptime()),
    freeMemMB: Math.round(os.freemem() / 1024 / 1024),
    totalMemMB: Math.round(os.totalmem() / 1024 / 1024),
    cpuCount: os.cpus().length,
  };
}

module.exports = {
  openApp,
  closeApp,
  setVolume,
  systemPower,
  takeScreenshot,
  getSystemInfo,
  KNOWN_APPS: Object.keys(APP_MAP[PLATFORM] || {}),
};
