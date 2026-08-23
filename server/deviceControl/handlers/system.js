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
    browser: "msedge",
    edge: "msedge",
    "microsoft edge": "msedge",
    msedge: "msedge",
    chrome: "chrome",
    notepad: "notepad",
    calculator: "calc",
    calc: "calc",
    explorer: "explorer",
    "file explorer": "explorer",
    files: "explorer",
    word: "winword",
    excel: "excel",
    powerpoint: "powerpnt",
    outlook: "outlook",
    teams: "ms-teams",
    spotify: "spotify",
    settings: "ms-settings:",
    "control panel": "control",
    "task manager": "taskmgr",
    paint: "mspaint",
    wordpad: "write",
    "command prompt": "cmd",
    cmd: "cmd",
    powershell: "powershell",
    terminal: "wt",
    vscode: "code",
    code: "code",
    camera: "microsoft.windows.camera:",
    photos: "ms-photos:",
    mail: "outlookmail:",
    store: "ms-windows-store:",
    whatsapp: "WhatsApp",
  },
  darwin: {
    browser: "Microsoft Edge",
    edge: "Microsoft Edge",
    "microsoft edge": "Microsoft Edge",
    chrome: "Google Chrome",
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
    browser: "microsoft-edge",
    edge: "microsoft-edge",
    "microsoft edge": "microsoft-edge",
    chrome: "google-chrome",
    notepad: "gedit",
    calculator: "gnome-calculator",
    "file explorer": "xdg-open",
    spotify: "spotify",
    terminal: "x-terminal-emulator",
  },
};

const WEB_SERVICES = {
  whatsapp: "https://web.whatsapp.com",
  "whatsapp web": "https://web.whatsapp.com",
  instagram: "https://www.instagram.com",
  youtube: "https://www.youtube.com",
  spotify: "https://open.spotify.com",
  "spotify web": "https://open.spotify.com",
  twitter: "https://x.com",
  x: "https://x.com",
  gmail: "https://mail.google.com",
  mail: "https://mail.google.com",
  reddit: "https://www.reddit.com",
  chatgpt: "https://chatgpt.com",
  github: "https://github.com",
  netflix: "https://www.netflix.com",
  amazon: "https://www.amazon.com",
  linkedin: "https://www.linkedin.com",
  facebook: "https://www.facebook.com",
  tiktok: "https://www.tiktok.com",
  discord: "https://discord.com/app",
  telegram: "https://web.telegram.org",
  notion: "https://www.notion.so",
  google: "https://www.google.com",
  bing: "https://www.bing.com",
};

function resolveApp(appName) {
  const table = APP_MAP[PLATFORM] || {};
  const key = String(appName || "").trim().toLowerCase();
  return table[key] || null;
}

function normalizeUrl(targetUrl) {
  let u = String(targetUrl || "").trim();
  if (!u) return "https://www.google.com";
  if (!/^https?:\/\//i.test(u)) {
    u = `https://${u}`;
  }
  return u;
}

function run(cmd, args = []) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 10_000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr?.toString() || err.message));
      resolve(stdout?.toString().trim() || "");
    });
  });
}

async function openUrl({ url, browser = "edge" }) {
  const fullUrl = normalizeUrl(url);
  const b = String(browser || "edge").toLowerCase();

  if (PLATFORM === "win32") {
    // Default to Microsoft Edge
    if (b.includes("chrome")) {
      await run("cmd.exe", ["/c", "start", "chrome", fullUrl]).catch(() =>
        run("cmd.exe", ["/c", "start", "msedge", fullUrl])
      );
    } else {
      await run("cmd.exe", ["/c", "start", "msedge", fullUrl]).catch(() =>
        run("cmd.exe", ["/c", "start", "", fullUrl])
      );
    }
  } else if (PLATFORM === "darwin") {
    if (b.includes("chrome")) {
      await run("open", ["-a", "Google Chrome", fullUrl]).catch(() => run("open", [fullUrl]));
    } else if (b.includes("safari")) {
      await run("open", ["-a", "Safari", fullUrl]).catch(() => run("open", [fullUrl]));
    } else {
      await run("open", ["-a", "Microsoft Edge", fullUrl]).catch(() => run("open", [fullUrl]));
    }
  } else {
    await run("microsoft-edge", [fullUrl]).catch(() => run("xdg-open", [fullUrl]));
  }
  return { openedUrl: fullUrl, browser: "Microsoft Edge" };
}

async function searchWeb({ query, engine = "google" }) {
  const q = String(query || "").trim();
  if (!q) throw new Error("Search query is required");
  const eng = String(engine || "google").toLowerCase();
  const searchUrl = eng.includes("bing")
    ? `https://www.bing.com/search?q=${encodeURIComponent(q)}`
    : `https://www.google.com/search?q=${encodeURIComponent(q)}`;
  return openUrl({ url: searchUrl, browser: "edge" });
}

function buildDeepServiceUrl(serviceName, query) {
  const s = String(serviceName || "").toLowerCase().trim();
  const rawQ = String(query || "").trim();
  const q = encodeURIComponent(rawQ);

  // Video & Music Streaming
  if (s.includes("youtube") || s === "yt") {
    return q ? `https://www.youtube.com/results?search_query=${q}` : "https://www.youtube.com";
  }
  if (s.includes("spotify")) {
    return q ? `https://open.spotify.com/search/${q}` : "https://open.spotify.com";
  }
  if (s.includes("netflix")) {
    return q ? `https://www.netflix.com/search?q=${q}` : "https://www.netflix.com";
  }
  if (s.includes("twitch")) {
    return q ? `https://www.twitch.tv/search?term=${q}` : "https://www.twitch.tv";
  }
  if (s.includes("prime") || s.includes("amazon video")) {
    return q ? `https://www.amazon.com/gp/video/search?phrase=${q}` : "https://www.primevideo.com";
  }
  if (s.includes("soundcloud")) {
    return q ? `https://soundcloud.com/search?q=${q}` : "https://soundcloud.com";
  }

  // Communication & Email
  if (s.includes("whatsapp")) {
    return q ? `https://web.whatsapp.com/send?text=${q}` : "https://web.whatsapp.com";
  }
  if (s.includes("gmail") || s === "email" || s === "mail") {
    if (rawQ.toLowerCase().startsWith("compose") || rawQ.toLowerCase().startsWith("write")) {
      return "https://mail.google.com/mail/u/0/#inbox?compose=new";
    }
    return q ? `https://mail.google.com/mail/u/0/#search/${q}` : "https://mail.google.com";
  }
  if (s.includes("outlook")) {
    return q ? `https://outlook.live.com/mail/0/id/${q}` : "https://outlook.live.com";
  }
  if (s.includes("telegram")) {
    return "https://web.telegram.org";
  }
  if (s.includes("discord")) {
    return "https://discord.com/app";
  }

  // Social & Content
  if (s.includes("twitter") || s === "x") {
    return q ? `https://x.com/search?q=${q}` : "https://x.com";
  }
  if (s.includes("reddit")) {
    return q ? `https://www.reddit.com/search/?q=${q}` : "https://www.reddit.com";
  }
  if (s.includes("instagram") || s === "insta") {
    if (rawQ && !rawQ.includes(" ")) {
      return `https://www.instagram.com/${encodeURIComponent(rawQ)}/`;
    }
    return q ? `https://www.instagram.com/explore/tags/${q}/` : "https://www.instagram.com";
  }
  if (s.includes("linkedin")) {
    return q ? `https://www.linkedin.com/search/results/all/?keywords=${q}` : "https://www.linkedin.com";
  }
  if (s.includes("facebook") || s === "fb") {
    return q ? `https://www.facebook.com/search/top/?q=${q}` : "https://www.facebook.com";
  }
  if (s.includes("tiktok")) {
    return q ? `https://www.tiktok.com/search?q=${q}` : "https://www.tiktok.com";
  }
  if (s.includes("pinterest")) {
    return q ? `https://www.pinterest.com/search/pins/?q=${q}` : "https://www.pinterest.com";
  }

  // Shopping & E-Commerce
  if (s.includes("amazon")) {
    return q ? `https://www.amazon.com/s?k=${q}` : "https://www.amazon.com";
  }
  if (s.includes("flipkart")) {
    return q ? `https://www.flipkart.com/search?q=${q}` : "https://www.flipkart.com";
  }
  if (s.includes("ebay")) {
    return q ? `https://www.ebay.com/sch/i.html?_nkw=${q}` : "https://www.ebay.com";
  }

  // Developer & Tech
  if (s.includes("github")) {
    return q ? `https://github.com/search?q=${q}` : "https://github.com";
  }
  if (s.includes("stackoverflow") || s.includes("stack overflow")) {
    return q ? `https://stackoverflow.com/search?q=${q}` : "https://stackoverflow.com";
  }
  if (s.includes("npm")) {
    return q ? `https://www.npmjs.com/search?q=${q}` : "https://www.npmjs.com";
  }

  // Maps & Location
  if (s.includes("map") || s.includes("location") || s.includes("directions")) {
    return q ? `https://www.google.com/maps/search/${q}` : "https://maps.google.com";
  }

  // Knowledge, News & Research
  if (s.includes("wikipedia") || s === "wiki") {
    return q ? `https://en.wikipedia.org/wiki/Special:Search?search=${q}` : "https://en.wikipedia.org";
  }
  if (s.includes("news") || s.includes("google news")) {
    return q ? `https://news.google.com/search?q=${q}` : "https://news.google.com";
  }
  if (s.includes("translate") || s.includes("google translate")) {
    return q ? `https://translate.google.com/?sl=auto&tl=en&text=${q}` : "https://translate.google.com";
  }
  if (s.includes("scholar") || s.includes("google scholar")) {
    return q ? `https://scholar.google.com/scholar?q=${q}` : "https://scholar.google.com";
  }
  if (s.includes("imdb")) {
    return q ? `https://www.imdb.com/find/?q=${q}` : "https://www.imdb.com";
  }
  if (s.includes("cricbuzz") || s.includes("cricket")) {
    return q ? `https://www.cricbuzz.com/search?q=${q}` : "https://www.cricbuzz.com";
  }
  if (s.includes("finance") || s.includes("yahoo finance") || s.includes("stock")) {
    return q ? `https://finance.yahoo.com/quote/${q}` : "https://finance.yahoo.com";
  }
  if (s.includes("crypto") || s.includes("coinmarketcap")) {
    return q ? `https://coinmarketcap.com/currencies/${q}` : "https://coinmarketcap.com";
  }
  if (s.includes("weather")) {
    return q ? `https://www.google.com/search?q=weather+${q}` : "https://www.google.com/search?q=weather+today";
  }
  if (s.includes("perplexity")) {
    return q ? `https://www.perplexity.ai/search?q=${q}` : "https://www.perplexity.ai";
  }

  // Search Engines
  if (s.includes("google")) {
    return q ? `https://www.google.com/search?q=${q}` : "https://www.google.com";
  }
  if (s.includes("bing")) {
    return q ? `https://www.bing.com/search?q=${q}` : "https://www.bing.com";
  }
  if (s.includes("duckduckgo")) {
    return q ? `https://duckduckgo.com/?q=${q}` : "https://duckduckgo.com";
  }

  // Fallback: If it's a recognized domain name (e.g. "imdb.com", "medium.com", "quora.com")
  if (s.includes(".com") || s.includes(".org") || s.includes(".net") || s.includes(".io") || s.includes(".ai")) {
    const domain = s.startsWith("http") ? s : `https://${s}`;
    return q ? `${domain}/search?q=${q}` : domain;
  }

  return null;
}

async function focusExistingWindow(query) {
  if (!query) return false;
  const q = String(query).replace(/['"`$]/g, "").trim();
  if (!q) return false;

  if (PLATFORM === "win32") {
    const script = `
Add-Type -TypeDefinition '
using System;
using System.Runtime.InteropServices;
public class WinUtil {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
}';
$proc = Get-Process | Where-Object {
  $_.MainWindowHandle -ne [IntPtr]::Zero -and (
    ($_.MainWindowTitle -and $_.MainWindowTitle -like '*${q}*') -or
    ($_.ProcessName -like '*${q}*')
  )
} | Select-Object -First 1;
if ($proc) {
  if ([WinUtil]::IsIconic($proc.MainWindowHandle)) {
    [WinUtil]::ShowWindowAsync($proc.MainWindowHandle, 9);
  }
  [WinUtil]::SetForegroundWindow($proc.MainWindowHandle);
  Write-Output "FOCUSED"
} else {
  Write-Output "NOT_FOUND"
}
`;
    const res = await run("powershell.exe", ["-NoProfile", "-Command", script]).catch(() => "NOT_FOUND");
    return res.includes("FOCUSED");
  } else if (PLATFORM === "darwin") {
    const script = `tell application "${q}" to activate`;
    const res = await run("osascript", ["-e", script]).catch(() => null);
    return res !== null;
  }
  return false;
}

async function openApp({ app, query }) {
  let name = String(app || "").trim().toLowerCase();
  let explicitQuery = query ? String(query).trim() : "";

  // Auto-detect embedded queries like "youtube AC/DC", "spotify daft punk", "google weather"
  if (!explicitQuery) {
    const prefixes = ["youtube", "spotify", "google", "bing", "reddit", "twitter", "amazon", "github", "maps", "wikipedia"];
    for (const prefix of prefixes) {
      if (name.startsWith(`${prefix} `) || name.startsWith(`${prefix}:`)) {
        explicitQuery = name.slice(prefix.length + 1).replace(/^(search|play|find|for)\s+/i, "").trim();
        name = prefix;
        break;
      }
    }
  }

  // Check if it's a direct URL
  if (name.startsWith("http://") || name.startsWith("https://") || name.includes(".com") || name.includes(".org") || name.includes(".net") || name.includes(".io")) {
    return openUrl({ url: name, browser: "edge" });
  }

  // Direct deep-link service check if query is provided
  if (explicitQuery) {
    const deepUrl = buildDeepServiceUrl(name, explicitQuery);
    if (deepUrl) {
      return openUrl({ url: deepUrl, browser: "edge" });
    }
  }

  // If no query was requested, check if the app/window is ALREADY open and focus it without launching duplicate instances!
  if (!explicitQuery) {
    const alreadyFocused = await focusExistingWindow(name);
    if (alreadyFocused) {
      return { opened: app, mode: "existing_window_focused" };
    }
  }

  // Check known web service mapping
  const webUrl = WEB_SERVICES[name];

  // Try native app first if configured in APP_MAP (when no specific search query was requested)
  const target = !explicitQuery ? resolveApp(name) : null;

  if (target) {
    try {
      if (PLATFORM === "darwin") {
        await run("open", ["-a", target]);
      } else if (PLATFORM === "win32") {
        await run("cmd.exe", ["/c", "start", "", target]);
      } else {
        await run(target, []);
      }
      return { opened: app, mode: "desktop_app" };
    } catch (err) {
      // If native app launch fails, fallback to Edge website
      if (webUrl) {
        console.log(`[system.openApp] Native app "${app}" launch failed, falling back to Edge website: ${webUrl}`);
        await openUrl({ url: webUrl, browser: "edge" });
        return { opened: app, mode: "edge_website_fallback", url: webUrl };
      }
      throw err;
    }
  }

  // If web service mapping exists
  if (webUrl) {
    const targetUrl = explicitQuery ? (buildDeepServiceUrl(name, explicitQuery) || webUrl) : webUrl;
    await openUrl({ url: targetUrl, browser: "edge" });
    return { opened: app, mode: "edge_website", url: targetUrl };
  }

  // Last attempt: try generic start in Windows or search on Edge
  if (PLATFORM === "win32") {
    try {
      await run("cmd.exe", ["/c", "start", "", name]);
      return { opened: app, mode: "system_start" };
    } catch (_) {
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(explicitQuery || app)}`;
      await openUrl({ url: searchUrl, browser: "edge" });
      return { opened: app, mode: "edge_search_fallback", url: searchUrl };
    }
  }

  const known = [...Object.keys(APP_MAP[PLATFORM] || {}), ...Object.keys(WEB_SERVICES)].join(", ");
  throw new Error(`"${app}" isn't in the known app list. Known apps & services: ${known}.`);
}

async function closeApp({ app }) {
  const target = resolveApp(app) || app;
  if (PLATFORM === "win32") {
    const image = target.toLowerCase().endsWith(".exe") ? target : `${target}.exe`;
    await run("taskkill", ["/IM", image, "/F"]).catch(() => {
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
    // Uses WScript.Shell SendKeys for VK_VOLUME_DOWN (174) and VK_VOLUME_UP (175)
    // Guaranteed zero-compilation instant volume control on stock Windows
    const downPresses = 50;
    const upPresses = Math.round(pct / 2);
    const script = `
try {
  $wsh = New-Object -ComObject WScript.Shell
  for ($i=0; $i -lt ${downPresses}; $i++) { $wsh.SendKeys([string][char]174) }
  for ($i=0; $i -lt ${upPresses}; $i++) { $wsh.SendKeys([string][char]175) }
} catch {}
`;
    await run("powershell.exe", ["-NoProfile", "-Command", script]).catch(() => {});
  }
  return { volume: pct, approximate: PLATFORM === "win32" };
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
    // Built-in .NET screen capture via PowerShell — no extra tool needed.
    const psPath = file.replace(/\\/g, "/");
    const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
try {
  $w = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width
  $h = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Height
  if ($w -le 0 -or $h -le 0) { $w = 1920; $h = 1080 }
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $graphics = [System.Drawing.Graphics]::FromImage($bmp)
  try {
    $graphics.CopyFromScreen(0, 0, 0, 0, (New-Object System.Drawing.Size $w, $h))
  } catch {}
  $bmp.Save('${psPath}', [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose(); $bmp.Dispose()
} catch {
  $bmp = New-Object System.Drawing.Bitmap 1920, 1080
  $bmp.Save('${psPath}', [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}`;
    await run("powershell.exe", ["-NoProfile", "-Command", script]).catch(() => {});
  } else {
    await run("import", ["-window", "root", file]).catch(() => {});
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
  openUrl,
  searchWeb,
  setVolume,
  systemPower,
  takeScreenshot,
  getSystemInfo,
  focusExistingWindow,
  WEB_SERVICES,
  KNOWN_APPS: [...Object.keys(APP_MAP[PLATFORM] || {}), ...Object.keys(WEB_SERVICES)],
};
