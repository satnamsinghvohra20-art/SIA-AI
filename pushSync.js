const { execSync } = require("child_process");
const fs = require("fs");

[
  "debugExecutionEnvironment.js",
  "testSpawnDetached.js",
  "testServerEndpoints.js",
  "clean.js",
].forEach(f => {
  try { fs.unlinkSync(f); } catch(_) {}
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
run('git commit -m "fix: non-blocking detached process launch and fix persistedHistory reference in chat router"');
console.log("Pushing to GitHub...");
run("git push origin main");
console.log("DONE");
