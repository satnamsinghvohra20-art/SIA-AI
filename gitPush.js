const { execSync } = require("child_process");

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

try {
  run("git init");
  run("git remote remove origin");
  run("git remote add origin https://github.com/satnamsinghvohra20-art/SIA-AI.git");
  run("git branch -M main");
  run("git add .");
  run('git commit -m "feat: complete Sia AI orchestrator with 300+ models, live voice agent, device control, and Docker"');
  console.log("Attempting push to origin main...");
  run("git push -u origin main");
} catch (e) {
  console.error("Git operation error:", e.message);
}
