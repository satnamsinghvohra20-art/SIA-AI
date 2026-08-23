const fs = require("fs/promises");
const path = require("path");

/**
 * FILE HANDLERS
 * -------------
 * Every path passed in from the model is resolved *inside* a configured
 * root directory (SIA_DEVICE_ROOT, default: <project>/data/device/files)
 * and rejected if it would escape that root — this is what stops
 * "delete ../../../important-thing" from ever reaching the real
 * filesystem call. Change SIA_DEVICE_ROOT in .env if you want Sia's file
 * actions to operate on a specific real folder (e.g. your Desktop) —
 * just be deliberate about it, since anything under that root is fair
 * game for delete/overwrite once a risky action is confirmed.
 */

function getRoot() {
  return process.env.SIA_DEVICE_ROOT || path.join(__dirname, "..", "..", "..", "data", "device", "files");
}

function resolveSafe(relativePath) {
  const root = getRoot();
  const target = path.resolve(root, relativePath || ".");
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error(
      `Path "${relativePath}" resolves outside the allowed folder (${root}). Refusing.`
    );
  }
  return target;
}

async function ensureRoot() {
  await fs.mkdir(getRoot(), { recursive: true });
}

async function listDir({ dir = "." }) {
  await ensureRoot();
  const target = resolveSafe(dir);
  const entries = await fs.readdir(target, { withFileTypes: true });
  return {
    dir,
    entries: entries.map((e) => ({
      name: e.name,
      type: e.isDirectory() ? "dir" : "file",
    })),
  };
}

async function readFile({ file }) {
  await ensureRoot();
  const target = resolveSafe(file);
  const content = await fs.readFile(target, "utf8");
  return { file, content: content.slice(0, 20_000) };
}

async function writeFile({ file, content = "" }) {
  await ensureRoot();
  const target = resolveSafe(file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, "utf8");
  return { file, bytesWritten: Buffer.byteLength(content, "utf8") };
}

async function moveFile({ from, to }) {
  await ensureRoot();
  const src = resolveSafe(from);
  const dest = resolveSafe(to);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.rename(src, dest);
  return { from, to };
}

async function deleteFile({ file }) {
  await ensureRoot();
  const target = resolveSafe(file);
  const stat = await fs.stat(target);
  if (stat.isDirectory()) {
    await fs.rm(target, { recursive: true, force: true });
  } else {
    await fs.unlink(target);
  }
  return { deleted: file };
}

module.exports = { listDir, readFile, writeFile, moveFile, deleteFile, getRoot };
