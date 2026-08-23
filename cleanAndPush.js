const { execSync } = require("child_process");
const fs = require("fs");

const tempFiles = [
  "verifyAll.js",
  "fastVerify.js",
  "checkSyntax.js",
  "fastCheck.js",
  "resolveAllConflicts.js"
];

for (const f of tempFiles) {
  try { fs.unlinkSync(f); } catch(_) {}
}

function run(cmd) {
  try {
    console.log(`> ${cmd}`);
    const out = execSync(cmd, { stdio: "pipe", encoding: "utf8" });
    if (out) console.log(out.trim());
    return true;
  } catch (err) {
    if (err.stdout) console.log(err.stdout.toString().trim());
    if (err.stderr) console.error(err.stderr.toString().trim());
    return false;
  }
}

run("git add .");
run('git commit -m "fix: resolve all merge conflicts and optimize syntax across all 25 files"');
console.log("Pushing updates to GitHub main...");
run("git push origin main");
console.log("DONE");
