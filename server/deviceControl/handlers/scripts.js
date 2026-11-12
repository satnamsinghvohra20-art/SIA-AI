const { exec, execFile } = require("child_process");
const fs = require("fs/promises");
const path = require("path");

const SCRIPTS_DIR = path.join(__dirname, "..", "scripts");
const PLATFORM = process.platform;

const RUNNERS = {
  ".sh": (file, args) => ["bash", [file, ...args]],
  ".py": (file, args) => ["python3", [file, ...args]],
  ".js": (file, args) => ["node", [file, ...args]],
  ".ps1": (file, args) => ["powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", file, ...args]],
};

async function listScripts() {
  await fs.mkdir(SCRIPTS_DIR, { recursive: true });
  const files = await fs.readdir(SCRIPTS_DIR);
  return files.filter((f) => RUNNERS[path.extname(f)]);
}

/**
 * Executes any arbitrary shell or terminal command directly on the host system.
 */
async function runCommand({ command, cwd = process.cwd() }) {
  if (!command || typeof command !== "string") {
    throw new Error("command string is required");
  }

  return new Promise((resolve) => {
    const opts = {
      cwd: path.resolve(cwd),
      timeout: 60_000,
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
    };

    if (PLATFORM === "win32") {
      exec(command, { ...opts, shell: "powershell.exe" }, (err, stdout, stderr) => {
        resolve({
          command,
          success: !err,
          stdout: stdout ? stdout.toString().slice(0, 8000) : "",
          stderr: stderr ? stderr.toString().slice(0, 4000) : "",
          error: err ? err.message : null,
        });
      });
    } else {
      exec(command, { ...opts, shell: "/bin/bash" }, (err, stdout, stderr) => {
        resolve({
          command,
          success: !err,
          stdout: stdout ? stdout.toString().slice(0, 8000) : "",
          stderr: stderr ? stderr.toString().slice(0, 4000) : "",
          error: err ? err.message : null,
        });
      });
    }
  });
}

async function runScript({ name, args = [] }) {
  await fs.mkdir(SCRIPTS_DIR, { recursive: true });
  const files = await fs.readdir(SCRIPTS_DIR);
  const match = files.find((f) => path.basename(f, path.extname(f)) === name);

  if (!match) {
    // If not found in scripts folder, try running as direct command
    return runCommand({ command: `${name} ${(args || []).join(" ")}` });
  }

  const ext = path.extname(match);
  const runner = RUNNERS[ext];
  if (!runner) throw new Error(`Script "${match}" has an unsupported extension "${ext}"`);

  const safeArgs = (Array.isArray(args) ? args : []).map(String);
  const [bin, binArgs] = runner(path.join(SCRIPTS_DIR, match), safeArgs);

  return new Promise((resolve, reject) => {
    execFile(bin, binArgs, { timeout: 60_000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr?.toString() || err.message));
      resolve({ script: name, stdout: stdout?.toString().slice(0, 8000) });
    });
  });
}

module.exports = { runCommand, runScript, listScripts, SCRIPTS_DIR };
