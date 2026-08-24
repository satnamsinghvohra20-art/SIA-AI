const { execSync } = require("child_process");
const fs = require("fs");

[
  "inspectWindows.js",
  "listProc.js",
  "testLaunchMethods.js",
  "testWaAutomation.js",
  "testWhatsAppSendFull.js",
  "verifyAllDeviceControls.js",
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
run('git commit -m "fix: robust PowerShell Start-Process URL launcher, STA WhatsApp message automation, and auto-submit voice dictation"');
console.log("Pushing updates to GitHub...");
run("git push origin main");
console.log("DONE");
