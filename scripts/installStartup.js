const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const startupDir = path.join(
  process.env.APPDATA,
  "Microsoft",
  "Windows",
  "Start Menu",
  "Programs",
  "Startup"
);
const shortcutPath = path.join(startupDir, "Sia247.lnk");
const vbsPath = path.join(__dirname, "start-sia-247-silent.vbs");

const psScript = [
  `$ws = New-Object -ComObject WScript.Shell`,
  `$s = $ws.CreateShortcut('${shortcutPath.replace(/\\/g, "\\\\")}')`,
  `$s.TargetPath = 'wscript.exe'`,
  `$s.Arguments = '"${vbsPath.replace(/\\/g, "\\\\")}"'`,
  `$s.WorkingDirectory = '${__dirname.replace(/\\/g, "\\\\")}'`,
  `$s.Description = 'Sia AI 24/7 Self-Healing Daemon'`,
  `$s.Save()`,
].join("; ");

try {
  execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psScript}"`);
  if (fs.existsSync(shortcutPath)) {
    console.log("SUCCESS: Sia247.lnk created in Windows Startup folder:");
    console.log(shortcutPath);
  } else {
    console.log("FAILED: Shortcut file not found.");
  }
} catch (e) {
  console.error("Error creating startup shortcut:", e.message);
}
