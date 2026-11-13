/**
 * SIA AI 24/7 SELF-HEALING SUPERVISOR DAEMON
 * -------------------------------------------
 * Keeps Sia AI running 24 hours a day, 7 days a week.
 *
 * Features:
 *  - Auto-restarts server on any crash or unhandled error
 *  - Manages Ngrok secure tunnel for 24/7 public access
 *  - Health watchdog: probes /api/health and recovers frozen processes
 *  - Logs everything to logs/daemon.log
 *  - Exports live status & links to data/live-status.json
 */

const { spawn, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const http = require("http");
const os = require("os");

const ROOT_DIR = path.resolve(__dirname, "..");
const LOG_DIR = path.join(ROOT_DIR, "logs");
const DATA_DIR = path.join(ROOT_DIR, "data");
const STATUS_FILE = path.join(DATA_DIR, "live-status.json");
const DAEMON_LOG = path.join(LOG_DIR, "daemon.log");

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  try {
    fs.appendFileSync(DAEMON_LOG, line);
  } catch {}
}

// Find Local Network IP
function getLocalNetworkIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "127.0.0.1";
}

// Find Ngrok executable
function getNgrokPath() {
  const customPath = "C:\\Users\\satna\\AppData\\Local\\Microsoft\\WindowsApps\\ngrok.exe";
  if (fs.existsSync(customPath)) return customPath;
  return "ngrok";
}

let serverProcess = null;
let ngrokProcess = null;
let serverRestarts = 0;
let ngrokRestarts = 0;
let livePublicUrl = null;
let isShuttingDown = false;
let failedHealthChecks = 0;

function updateStatus(extra = {}) {
  const status = {
    online: !!serverProcess,
    pid: serverProcess ? serverProcess.pid : null,
    port: process.env.PORT || 3000,
    localUrl: `http://localhost:${process.env.PORT || 3000}`,
    networkUrl: `http://${getLocalNetworkIp()}:${process.env.PORT || 3000}`,
    publicUrl: livePublicUrl,
    restarts: serverRestarts,
    uptimeSeconds: Math.floor(process.uptime()),
    updatedAt: new Date().toISOString(),
    ...extra,
  };
  try {
    fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
  } catch {}
}

// Start Server with Auto-Restart
function startServer() {
  if (isShuttingDown) return;

  log(`[Server] Spawning Node server process (server/index.js)...`);
  serverProcess = spawn(process.execPath, [path.join(ROOT_DIR, "server", "index.js")], {
    cwd: ROOT_DIR,
    env: { ...process.env, HOST: "0.0.0.0" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  serverProcess.stdout.on("data", (chunk) => {
    process.stdout.write(`[Sia] ${chunk}`);
  });

  serverProcess.stderr.on("data", (chunk) => {
    process.stderr.write(`[Sia:err] ${chunk}`);
  });

  serverProcess.on("exit", (code, signal) => {
    serverProcess = null;
    log(`[Server] Server process exited (code=${code}, signal=${signal}).`);
    if (!isShuttingDown) {
      serverRestarts++;
      updateStatus({ online: false, error: `Exited with code ${code}` });
      log(`[Server] Self-healing: auto-restarting server in 1500ms...`);
      setTimeout(startServer, 1500);
    }
  });

  updateStatus();
}

// Start Ngrok Tunnel with Auto-Restart
function startNgrok() {
  if (isShuttingDown) return;

  const ngrokBin = getNgrokPath();
  const port = process.env.PORT || 3000;
  log(`[Tunnel] Launching Ngrok tunnel on port ${port}...`);

  ngrokProcess = spawn(ngrokBin, ["http", String(port), "--log=stdout"], {
    cwd: ROOT_DIR,
    stdio: ["ignore", "pipe", "pipe"],
  });

  ngrokProcess.stdout.on("data", (chunk) => {
    // silently consume or debug log
  });

  ngrokProcess.stderr.on("data", (chunk) => {
    process.stderr.write(`[Tunnel:err] ${chunk}`);
  });

  ngrokProcess.on("exit", (code, signal) => {
    ngrokProcess = null;
    livePublicUrl = null;
    log(`[Tunnel] Ngrok tunnel exited (code=${code}, signal=${signal}).`);
    if (!isShuttingDown) {
      ngrokRestarts++;
      log(`[Tunnel] Reconnecting Ngrok tunnel in 3000ms...`);
      setTimeout(startNgrok, 3000);
    }
  });

  pollTunnelUrl();
}

// Poll 127.0.0.1:4040/api/tunnels for the public URL
function pollTunnelUrl(attempts = 0) {
  if (isShuttingDown || livePublicUrl) return;

  const req = http.get("http://127.0.0.1:4040/api/tunnels", (res) => {
    let data = "";
    res.on("data", (chunk) => (data += chunk));
    res.on("end", () => {
      try {
        const json = JSON.parse(data);
        if (json.tunnels && json.tunnels.length > 0) {
          livePublicUrl = json.tunnels[0].public_url;
          log(`\n======================================================`);
          log(`🚀 SIA AI IS LIVE 24/7!`);
          log(`🌐 Public Live URL : ${livePublicUrl}`);
          log(`💻 Local URL       : http://localhost:${process.env.PORT || 3000}`);
          log(`📱 Mobile LAN URL  : http://${getLocalNetworkIp()}:${process.env.PORT || 3000}`);
          log(`======================================================\n`);
          updateStatus();
          return;
        }
      } catch {}
      if (attempts < 20) setTimeout(() => pollTunnelUrl(attempts + 1), 1000);
    });
  });

  req.on("error", () => {
    if (attempts < 20) setTimeout(() => pollTunnelUrl(attempts + 1), 1000);
  });
}

// Watchdog: Probe /api/health every 15s
function checkHealth() {
  if (isShuttingDown || !serverProcess) return;

  const port = process.env.PORT || 3000;
  const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
    if (res.statusCode === 200) {
      failedHealthChecks = 0;
      updateStatus({ healthy: true });
    } else {
      failedHealthChecks++;
      log(`[Watchdog] Warning: health check returned status ${res.statusCode} (consecutive failures: ${failedHealthChecks})`);
      evaluateWatchdog();
    }
  });

  req.on("error", (err) => {
    failedHealthChecks++;
    log(`[Watchdog] Warning: health check error: ${err.message} (consecutive failures: ${failedHealthChecks})`);
    evaluateWatchdog();
  });

  req.setTimeout(5000, () => {
    req.destroy();
    failedHealthChecks++;
    log(`[Watchdog] Warning: health check timed out (consecutive failures: ${failedHealthChecks})`);
    evaluateWatchdog();
  });
}

function evaluateWatchdog() {
  if (failedHealthChecks >= 3 && serverProcess) {
    log(`[Watchdog] Unresponsive process detected (3 consecutive health timeouts). Restarting server...`);
    failedHealthChecks = 0;
    try {
      serverProcess.kill("SIGKILL");
    } catch {}
  }
}

// Graceful Exit
function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  log(`\n[Daemon] Received ${signal}. Stopping 24/7 supervisor cleanly...`);

  if (serverProcess) {
    try {
      serverProcess.kill("SIGTERM");
    } catch {}
  }
  if (ngrokProcess) {
    try {
      ngrokProcess.kill("SIGTERM");
    } catch {}
  }

  updateStatus({ online: false, terminated: true });
  setTimeout(() => process.exit(0), 1000);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("uncaughtException", (err) => {
  log(`[Daemon:FATAL] Uncaught Exception: ${err.stack || err.message}`);
});

log(`[Daemon] Sia AI 24/7 Supervisor started (PID=${process.pid}).`);
startServer();
startNgrok();

// Start watchdog loop
setInterval(checkHealth, 15000);
