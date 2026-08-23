const { execSync } = require("child_process");
const fs = require("fs");

try { fs.unlinkSync("doPush.js"); } catch(_) {}

try {
  const status = execSync("git status", { encoding: "utf8" });
  console.log(status);
  const push = execSync("git push origin main", { encoding: "utf8" });
  console.log(push);
} catch (e) {
  console.log("ERR:", e.stdout || e.stderr || e.message);
}
