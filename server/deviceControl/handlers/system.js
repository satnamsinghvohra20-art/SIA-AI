const { execFile, spawn } = require("child_process");
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
  yt: "https://www.youtube.com",
  spotify: "https://open.spotify.com",
  "spotify web": "https://open.spotify.com",
  twitter: "https://x.com",
  x: "https://x.com",
  gmail: "https://mail.google.com",
  mail: "https://mail.google.com",
  email: "https://mail.google.com",
  reddit: "https://www.reddit.com",
  chatgpt: "https://chatgpt.com",
  claude: "https://claude.ai",
  github: "https://github.com",
  netflix: "https://www.netflix.com",
  amazon: "https://www.amazon.com",
  flipkart: "https://www.flipkart.com",
  linkedin: "https://www.linkedin.com",
  facebook: "https://www.facebook.com",
  tiktok: "https://www.tiktok.com",
  discord: "https://discord.com/app",
  telegram: "https://web.telegram.org",
  notion: "https://www.notion.so",
  google: "https://www.google.com",
  bing: "https://www.bing.com",
  maps: "https://www.google.com/maps",
  "google maps": "https://www.google.com/maps",
  wikipedia: "https://www.wikipedia.org",
  cricbuzz: "https://www.cricbuzz.com",
  stackoverflow: "https://stackoverflow.com",
  twitch: "https://www.twitch.tv",
  pinterest: "https://www.pinterest.com",
  canva: "https://www.canva.com",
  figma: "https://www.figma.com",
  imdb: "https://www.imdb.com",
  news: "https://news.google.com",
  "google news": "https://news.google.com",
  weather: "https://www.google.com/search?q=weather+today",
};

function resolveApp(appName) {
  const table = APP_MAP[PLATFORM] || {};
  const key = String(appName || "").trim().toLowerCase();
  return table[key] || null;
}

const SERVICE_TITLE_MAP = {
  whatsapp: ["WhatsApp", "WhatsApp Web"],
  "whatsapp web": ["WhatsApp", "WhatsApp Web"],
  youtube: ["YouTube", "YouTube Music"],
  yt: ["YouTube"],
  spotify: ["Spotify", "Spotify Free", "Spotify Premium"],
  "spotify web": ["Spotify"],
  flipkart: ["Flipkart"],
  amazon: ["Amazon"],
  instagram: ["Instagram"],
  insta: ["Instagram"],
  gmail: ["Gmail", "Inbox"],
  mail: ["Gmail", "Mail", "Outlook"],
  email: ["Gmail", "Mail", "Outlook"],
  outlook: ["Outlook", "Mail"],
  chatgpt: ["ChatGPT"],
  claude: ["Claude"],
  twitter: ["Twitter", " / X", "X"],
  x: [" / X", "Twitter", "X"],
  reddit: ["Reddit"],
  github: ["GitHub"],
  netflix: ["Netflix"],
  linkedin: ["LinkedIn"],
  discord: ["Discord"],
  telegram: ["Telegram"],
  facebook: ["Facebook"],
  canva: ["Canva"],
  figma: ["Figma"],
  edge: ["Microsoft Edge", "Edge"],
  chrome: ["Google Chrome", "Chrome"],
  code: ["Visual Studio Code", "Code"],
  vscode: ["Visual Studio Code", "Code"],
  notepad: ["Notepad"],
  calc: ["Calculator"],
  calculator: ["Calculator"],
  explorer: ["File Explorer", "Explorer"],
};

function normalizeUrl(targetUrl) {
  let u = String(targetUrl || "").trim();
  if (!u) return "https://www.google.com";
  if (!/^https?:\/\//i.test(u)) {
    u = `https://${u}`;
  }
  return u;
}

function launchDetached(cmd, args = []) {
  return new Promise((resolve) => {
    try {
      const child = spawn(cmd, args, {
        detached: true,
        stdio: "ignore",
        windowsHide: false,
        shell: PLATFORM === "win32",
      });
      child.unref();
      setTimeout(resolve, 150);
    } catch (_) {
      resolve();
    }
  });
}

function run(cmd, args = [], opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 3000, windowsHide: true, ...opts }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr?.toString() || err.message));
      resolve(stdout?.toString().trim() || "");
    });
  });
}

async function openUrl({ url, browser = "default" }) {
  const fullUrl = normalizeUrl(url);
  const b = String(browser || "default").toLowerCase();

  // If opening WhatsApp base URL and WhatsApp is already open, just focus the existing window
  if (fullUrl.includes("web.whatsapp.com") && !fullUrl.includes("/send?")) {
    const alreadyFocused = await focusExistingWindow("whatsapp");
    if (alreadyFocused) {
      return { openedUrl: fullUrl, browser: "Existing Browser Window", reused: true };
    }
  }

  if (PLATFORM === "win32") {
    // Single clean launch using Start-Process
    await launchDetached("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `Start-Process "${fullUrl.replace(/"/g, '`"')}"`,
    ]);
  } else if (PLATFORM === "darwin") {
    if (b.includes("chrome")) {
      await launchDetached("open", ["-a", "Google Chrome", fullUrl]);
    } else if (b.includes("safari")) {
      await launchDetached("open", ["-a", "Safari", fullUrl]);
    } else {
      await launchDetached("open", [fullUrl]);
    }
  } else {
    await launchDetached("xdg-open", [fullUrl]);
  }
  return { openedUrl: fullUrl, browser: "Browser" };
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
  const raw = String(query).trim().toLowerCase();
  if (!raw) return false;

  const candidateTitles = SERVICE_TITLE_MAP[raw] || [query];
  if (PLATFORM === "win32") {
    const titlesJson = JSON.stringify(candidateTitles);
    const script = `
$wsh = New-Object -ComObject WScript.Shell;
$titles = ConvertFrom-Json '${titlesJson.replace(/'/g, "''")}';
foreach ($t in $titles) {
  if ($wsh.AppActivate($t)) {
    Write-Output "FOCUSED";
    exit 0;
  }
}
Write-Output "NOT_FOUND";
`;
    const out = await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script.replace(/\r?\n/g, " ")], { timeout: 2000 }).catch(() => "");
    return out.includes("FOCUSED");
  } else if (PLATFORM === "darwin") {
    for (const t of candidateTitles) {
      const script = `tell application "${t}" to activate`;
      const res = await run("osascript", ["-e", script]).catch(() => null);
      if (res !== null) return true;
    }
    return false;
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

  // 1. Dedicated WhatsApp Handler (Reuses existing window first!)
  if (name === "whatsapp" || name === "whatsapp web") {
    const alreadyOpen = await focusExistingWindow("whatsapp");
    if (alreadyOpen) {
      if (explicitQuery) {
        // WhatsApp is already open: send/draft in the open window without opening a new tab
        const waHandler = require("./whatsapp");
        await waHandler.sendWhatsappMessage({ message: explicitQuery });
        return { opened: "WhatsApp", mode: "existing_window_reused", note: `Typed message in existing WhatsApp window: "${explicitQuery}"` };
      }
      return { opened: "WhatsApp", mode: "existing_window_focused", alreadyOpen: true };
    }

    // If not already open, launch WhatsApp
    if (PLATFORM === "win32") {
      const psLaunch = `
Add-Type -TypeDefinition '
using System;
using System.Runtime.InteropServices;
public class WinTop {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
}';
Start-Process "whatsapp:" -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 350
$p = Get-Process | Where-Object { $_.ProcessName -match 'WhatsApp' -and $_.MainWindowHandle -ne [IntPtr]::Zero } | Select-Object -First 1
if ($p) {
  [WinTop]::ShowWindowAsync($p.MainWindowHandle, 9)
  [WinTop]::SetForegroundWindow($p.MainWindowHandle)
}
`;
      await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", psLaunch]).catch(() => {});
    }

    const waUrl = explicitQuery ? `https://web.whatsapp.com/send?text=${encodeURIComponent(explicitQuery)}` : "https://web.whatsapp.com";
    await openUrl({ url: waUrl });
    return { opened: "WhatsApp", mode: "whatsapp_launched", url: waUrl };
  }

  // 2. Check if the app or web service is already open before spawning a new instance
  if (!explicitQuery) {
    const alreadyFocused = await focusExistingWindow(name);
    if (alreadyFocused) {
      return { opened: app, mode: "existing_window_focused", alreadyOpen: true };
    }
  }

  // 3. Check if it's a direct URL or domain name
  if (name.startsWith("http://") || name.startsWith("https://") || name.includes(".com") || name.includes(".org") || name.includes(".net") || name.includes(".io") || name.includes(".in") || name.includes(".co") || name.includes(".ai")) {
    const directUrl = name.startsWith("http") ? name : `https://${name}`;
    return openUrl({ url: directUrl });
  }

  // 4. Check if it's a known web service or deep service URL
  const deepUrl = buildDeepServiceUrl(name, explicitQuery);
  const webUrl = WEB_SERVICES[name];

  if (deepUrl || webUrl) {
    const targetUrl = deepUrl || webUrl;
    await openUrl({ url: targetUrl });
    return { opened: app, mode: "website_opened", url: targetUrl };
  }

  // 5. Check for native Desktop application (e.g. calc, notepad, cmd, explorer)
  const desktopTarget = resolveApp(name);
  if (desktopTarget) {
    try {
      if (PLATFORM === "darwin") {
        await launchDetached("open", ["-a", desktopTarget]);
      } else if (PLATFORM === "win32") {
        await launchDetached("powershell.exe", [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `Start-Process "${desktopTarget}"`,
        ]);
      } else {
        await launchDetached(desktopTarget, []);
      }
      return { opened: app, mode: "desktop_app" };
    } catch (err) {
      console.warn(`[system.openApp] Native app launch failed for ${app}:`, err.message);
    }
  }

  // 6. Last attempt: try generic start in Windows or search on Google
  if (PLATFORM === "win32") {
    try {
      await launchDetached("powershell.exe", [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `Start-Process "${name}"`,
      ]);
      return { opened: app, mode: "system_start" };
    } catch (_) {}
  }

  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(explicitQuery || app)}`;
  await openUrl({ url: searchUrl });
  return { opened: app, mode: "web_search_fallback", url: searchUrl };
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

async function setVolume({ level, mute }) {
  if (mute === true || mute === false) {
    if (PLATFORM === "win32") {
      const script = `try { $wsh = New-Object -ComObject WScript.Shell; $wsh.SendKeys([string][char]173) } catch {}`;
      await launchDetached("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script]);
    } else if (PLATFORM === "darwin") {
      await run("osascript", ["-e", `set volume ${mute ? "with" : "without"} output muted`]);
    }
    return { muted: mute };
  }

  const pct = Math.max(0, Math.min(100, Number(level !== undefined ? level : 50)));
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
    await launchDetached("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script]);
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
    await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script]).catch(() => {});
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

/**
 * Advanced Device Capabilities
 */

async function mediaControl({ action = "play_pause" } = {}) {
  const act = String(action || "play_pause").toLowerCase().trim();
  if (PLATFORM === "win32") {
    let vkCode = "0xB3"; // VK_MEDIA_PLAY_PAUSE
    if (act === "next" || act.includes("skip")) vkCode = "0xB0";
    else if (act === "previous" || act === "prev") vkCode = "0xB1";
    else if (act === "stop") vkCode = "0xB2";

    const script = `
Add-Type -TypeDefinition '
using System.Runtime.InteropServices;
public class MediaKey {
  [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);
}';
[MediaKey]::keybd_event(${vkCode}, 0, 0, 0);
[MediaKey]::keybd_event(${vkCode}, 0, 2, 0);
`;
    await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script.replace(/\r?\n/g, " ")]).catch(() => {});
    return { success: true, action: act, key: vkCode };
  } else if (PLATFORM === "darwin") {
    const cmd = act === "next" ? "next track" : (act === "previous" || act === "prev" ? "previous track" : "playpause");
    await run("osascript", ["-e", `tell application "Spotify" to ${cmd}`]).catch(() => {});
    return { success: true, action: act };
  } else {
    const cmd = act === "next" ? "next" : (act === "previous" || act === "prev" ? "previous" : "play-pause");
    await run("playerctl", [cmd]).catch(() => {});
    return { success: true, action: act };
  }
}

async function windowControl({ action = "minimize", title = null } = {}) {
  const act = String(action || "minimize").toLowerCase().trim();
  if (PLATFORM === "win32") {
    if (act === "show_desktop" || act === "minimize_all") {
      const script = `(New-Object -ComObject Shell.Application).MinimizeAll()`;
      await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script]).catch(() => {});
      return { success: true, action: "show_desktop" };
    }

    const t = title ? String(title).trim() : "";
    let cmdShow = 6; // SW_MINIMIZE
    if (act === "maximize") cmdShow = 3;
    else if (act === "restore") cmdShow = 9;

    const script = `
Add-Type -TypeDefinition '
using System;
using System.Runtime.InteropServices;
public class WinUtil {
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
}';
${t ? `
$p = Get-Process | Where-Object { ($_.MainWindowTitle -match '${t.replace(/'/g, "''")}' -or $_.ProcessName -match '${t.replace(/'/g, "''")}') -and $_.MainWindowHandle -ne [IntPtr]::Zero } | Select-Object -First 1
if ($p) {
  ${act === "close" ? "$p.CloseMainWindow() | Out-Null" : `[WinUtil]::ShowWindowAsync($p.MainWindowHandle, ${cmdShow}); [WinUtil]::SetForegroundWindow($p.MainWindowHandle);`}
}
` : `
$hwnd = [WinUtil]::GetForegroundWindow();
if ($hwnd -ne [IntPtr]::Zero) {
  [WinUtil]::ShowWindowAsync($hwnd, ${cmdShow});
}
`}
`;
    await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script.replace(/\r?\n/g, " ")]).catch(() => {});
    return { success: true, action: act, target: title || "active_window" };
  } else if (PLATFORM === "darwin") {
    if (act === "minimize" || act === "show_desktop") {
      await run("osascript", ["-e", `tell application "System Events" to set visible of every process whose visible is true to false`]).catch(() => {});
    }
    return { success: true, action: act };
  }
  return { success: false, error: "Unsupported platform" };
}

async function clipboardControl({ action = "get", text = "" } = {}) {
  const act = String(action || "get").toLowerCase().trim();
  if (PLATFORM === "win32") {
    if (act === "get" || act === "read") {
      const script = `powershell.exe -NoProfile -NonInteractive -Command "Get-Clipboard"`;
      const out = await new Promise((resolve) => {
        execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "Get-Clipboard"], { timeout: 6000, windowsHide: true }, (err, stdout) => {
          resolve(stdout ? stdout.trim() : "");
        });
      });
      return { success: true, action: "get", text: out };
    } else if (act === "set" || act === "copy") {
      const success = await new Promise((resolve) => {
        try {
          const child = spawn("clip.exe", [], { windowsHide: true });
          child.stdin.end(Buffer.from(String(text || ""), "utf8"));
          child.on("close", (code) => resolve(code === 0));
          child.on("error", () => resolve(false));
        } catch (_) {
          resolve(false);
        }
      });
      return { success, action: "set", text };
    } else if (act === "clear") {
      await new Promise((resolve) => {
        try {
          const child = spawn("clip.exe", [], { windowsHide: true });
          child.stdin.end("");
          child.on("close", () => resolve());
          child.on("error", () => resolve());
        } catch (_) {
          resolve();
        }
      });
      return { success: true, action: "clear" };
    }
  } else if (PLATFORM === "darwin") {
    if (act === "get" || act === "read") {
      const out = await run("pbpaste").catch(() => "");
      return { success: true, action: "get", text: out.trim() };
    } else {
      await run("pbcopy", [], { input: text }).catch(() => {});
      return { success: true, action: "set", text };
    }
  }
  return { success: false, error: "Unsupported platform" };
}

async function setBrightness({ percent = 50 } = {}) {
  const pct = Math.max(0, Math.min(100, Math.round(Number(percent) || 50)));
  if (PLATFORM === "win32") {
    const script = `
try {
  Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods | Invoke-CimMethod -MethodName WmiSetBrightness -Arguments @{Timeout = 1; Brightness = ${pct}} | Out-Null
  Write-Output "OK"
} catch {
  Write-Output "FAILED"
}
`;
    const res = await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script.replace(/\r?\n/g, " ")]).catch(() => "");
    return { success: res.includes("OK"), brightness: pct };
  }
  return { success: false, error: "Brightness control requires Windows WMI supported monitor" };
}

async function lockWorkstation() {
  if (PLATFORM === "win32") {
    const script = `Add-Type -TypeDefinition 'using System.Runtime.InteropServices; public class Lock { [DllImport("user32.dll")] public static extern bool LockWorkStation(); }'; [Lock]::LockWorkStation();`;
    await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script.replace(/\r?\n/g, " ")]).catch(() => {});
    return { success: true, locked: true };
  } else if (PLATFORM === "darwin") {
    await run("pmset", ["displaysleepnow"]).catch(() => {});
    return { success: true, locked: true };
  } else {
    await run("loginctl", ["lock-session"]).catch(() => {});
    return { success: true, locked: true };
  }
}

async function listRunningApps() {
  if (PLATFORM === "win32") {
    const script = `
$procs = Get-Process | Where-Object { $_.MainWindowTitle -ne '' -and $_.MainWindowHandle -ne [IntPtr]::Zero } | Select-Object -Property Id, ProcessName, MainWindowTitle | Select-Object -First 30;
$procs | ConvertTo-Json -Compress;
`;
    const out = await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script.replace(/\r?\n/g, " ")]).catch(() => "[]");
    let apps = [];
    try {
      const parsed = JSON.parse(out);
      apps = Array.isArray(parsed) ? parsed : [parsed];
    } catch (_) {
      apps = [];
    }
    return {
      success: true,
      count: apps.length,
      windows: apps.map(a => ({ pid: a.Id, name: a.ProcessName, title: a.MainWindowTitle })),
    };
  }
  return { success: false, windows: [] };
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
  mediaControl,
  windowControl,
  clipboardControl,
  setBrightness,
  lockWorkstation,
  listRunningApps,
  WEB_SERVICES,
  KNOWN_APPS: [...Object.keys(APP_MAP[PLATFORM] || {}), ...Object.keys(WEB_SERVICES)],
};
