const { execSync } = require("child_process");
const fs = require("fs");

try { fs.unlinkSync("syncCheck.js"); } catch(_) {}

let out = "";
try {
  out += execSync("git status", { encoding: "utf8" }) + "\n";
  out += execSync("git log -n 1 --oneline", { encoding: "utf8" }) + "\n";
} catch (e) {
  out += e.message;
}

fs.writeFileSync("git_status_report.txt", out);
console.log(out);
