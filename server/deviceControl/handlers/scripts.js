const { execFile } = require("child_process");
const fs = require("fs/promises");
const path = require("path");

/**
 * SCRIPT HANDLER
 * --------------
 * Deliberately NOT "run this arbitrary shell string the model wrote."
 * Sia can only run scripts that already exist in server/deviceControl/scripts/
 * — you write and review them, they get a name, and only then can a device
 * task invoke them by that name. This is the difference between "device
 * automation" and "a chat box that is also a remote shell."
 *
 * To add a script: drop a .sh/.js/.py file in server/deviceControl/scripts/
 * and it becomes callable as run_script({ name: "<filename-without-ext>" }).
 */

const SCRIPTS_DIR = path.join(__dirname, "..", "scripts");

const RUNNERS = {
  ".sh": (file, args) => ["bash", [file, ...args]],
  ".py": (file, args) => ["python3", [file, ...args]],
  ".js": (file, args) => ["node", [file, ...args]],
};

async function listScripts() {
  await fs.mkdir(SCRIPTS_DIR, { recursive: true });
  const files = await fs.readdir(SCRIPTS_DIR);
  return files.filter((f) => RUNNERS[path.extname(f)]);
}

async function runScript({ name, args = [] }) {
  await fs.mkdir(SCRIPTS_DIR, { recursive: true });
  const files = await fs.readdir(SCRIPTS_DIR);
  const match = files.find((f) => path.basename(f, path.extname(f)) === name);

  if (!match) {
    const known = files.filter((f) => RUNNERS[path.extname(f)]);
    throw new Error(
      `No whitelisted script named "${name}". Available: ${known.join(", ") || "(none yet — add one to server/deviceControl/scripts/)"}`
    );
  }

  const ext = path.extname(match);
  const runner = RUNNERS[ext];
  if (!runner) throw new Error(`Script "${match}" has an unsupported extension "${ext}"`);

  const safeArgs = (Array.isArray(args) ? args : []).map(String).slice(0, 20);
  const [bin, binArgs] = runner(path.join(SCRIPTS_DIR, match), safeArgs);

  return new Promise((resolve, reject) => {
    execFile(bin, binArgs, { timeout: 30_000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr?.toString() || err.message));
      resolve({ script: name, stdout: stdout?.toString().slice(0, 4000) });
    });
  });
}

module.exports = { runScript, listScripts, SCRIPTS_DIR };
