const { execSync } = require("child_process");
const fs = require("fs");

[
  "checkOpenRouterFreeModels.js",
  "testDetachedWa.js",
  "testFastWaLaunch.js",
  "testTypeAndWa.js",
  "testWhatsAppTypingAutomation.js",
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
run('git commit -m "fix: WhatsApp typing automation, non-blocking UI controls, and truthful verified action links"');
console.log("Pushing to GitHub...");
run("git push origin main");
console.log("DONE");
