const fs = require("fs");
const path = require("path");
const http = require("http");

const STATUS_FILE = path.join(__dirname, "..", "data", "live-status.json");

if (!fs.existsSync(STATUS_FILE)) {
  console.log("⚠️  Sia 24/7 daemon is not running. Start it with: npm run daemon");
  process.exit(0);
}

try {
  const status = JSON.parse(fs.readFileSync(STATUS_FILE, "utf-8"));
  console.log("\n================ SIA AI 24/7 STATUS ================");
  console.log(`Status        : ${status.online ? "🟢 ONLINE" : "🔴 OFFLINE"}`);
  console.log(`Server PID    : ${status.pid || "None"}`);
  console.log(`Public Live   : ${status.publicUrl || "Establishing tunnel..."}`);
  console.log(`Local Access  : ${status.localUrl}`);
  console.log(`Mobile Access : ${status.networkUrl}`);
  console.log(`Restarts      : ${status.restarts}`);
  console.log(`Uptime (sec)  : ${status.uptimeSeconds}s`);
  console.log(`Last Checked  : ${status.updatedAt}`);
  console.log("====================================================\n");
} catch (e) {
  console.error("Failed to read status:", e.message);
}
