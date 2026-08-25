const { execSync } = require("child_process");
const fs = require("fs");

function run(cmd) {
  console.log(`> ${cmd}`);
  try {
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
run('git commit -m "feat: reuse active web applications and WhatsApp window across consecutive tasks"');
console.log("Pushing to GitHub main...");
run("git push origin main");
console.log("SUCCESS");

try { fs.unlinkSync("doGitPush.js"); } catch (_) {}
