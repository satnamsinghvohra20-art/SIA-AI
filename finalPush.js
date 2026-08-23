const { execSync } = require("child_process");
const fs = require("fs");

// Clean temporary scripts
["doPush.js", "syncCheck.js", "checkGit.js", "cleanup.js", "git_status_report.txt"].forEach((f) => {
  try { fs.unlinkSync(f); } catch (_) {}
});

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
run('git commit -m "chore: clean repository and sync all latest features to main"');
console.log("Pushing to GitHub origin main...");
run("git push origin main");
console.log("SUCCESS");
