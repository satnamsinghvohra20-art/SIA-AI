const { execSync } = require("child_process");
const fs = require("fs");

try { fs.unlinkSync("cleanAndPush.js"); } catch(_) {}

try {
  console.log("Pushing to origin main...");
  const out = execSync("git push origin main", { stdio: "pipe", encoding: "utf8" });
  if (out) console.log(out.trim());
  console.log("PUSH_SUCCESS");
} catch (err) {
  if (err.stdout) console.log(err.stdout.toString().trim());
  if (err.stderr) console.error(err.stderr.toString().trim());
}
