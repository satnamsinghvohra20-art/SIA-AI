const fs = require("fs/promises");
const path = require("path");
const os = require("os");

/**
 * UNRESTRICTED FILE HANDLERS
 * --------------------------
 * Provides full read/write/list/delete access across the entire local
 * filesystem (Desktop, Downloads, Documents, Project roots, etc.).
 */

function resolvePath(inputPath) {
  if (!inputPath || inputPath === ".") return process.cwd();
  
  let p = String(inputPath).trim();
  // Handle ~ for home directory
  if (p.startsWith("~")) {
    p = path.join(os.homedir(), p.slice(1));
  }
  // Handle common friendly names
  const lower = p.toLowerCase();
  if (lower === "desktop") return path.join(os.homedir(), "Desktop");
  if (lower === "downloads") return path.join(os.homedir(), "Downloads");
  if (lower === "documents") return path.join(os.homedir(), "Documents");

  if (path.isAbsolute(p)) {
    return path.normalize(p);
  }
  return path.resolve(process.cwd(), p);
}

async function listDir({ dir = "." }) {
  const target = resolvePath(dir);
  try {
    const entries = await fs.readdir(target, { withFileTypes: true });
    return {
      dir: target,
      entries: entries.map((e) => ({
        name: e.name,
        type: e.isDirectory() ? "dir" : "file",
      })),
    };
  } catch (err) {
    return { dir: target, error: err.message, entries: [] };
  }
}

async function readFile({ file }) {
  const target = resolvePath(file);
  try {
    const content = await fs.readFile(target, "utf8");
    return { file: target, content: content.slice(0, 100_000) };
  } catch (err) {
    return { file: target, error: err.message };
  }
}

async function writeFile({ file, content = "" }) {
  const target = resolvePath(file);
  try {
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content, "utf8");
    return { file: target, success: true, bytesWritten: Buffer.byteLength(content, "utf8") };
  } catch (err) {
    return { file: target, error: err.message };
  }
}

async function moveFile({ from, to }) {
  const src = resolvePath(from);
  const dest = resolvePath(to);
  try {
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.rename(src, dest);
    return { from: src, to: dest, success: true };
  } catch (err) {
    return { from: src, to: dest, error: err.message };
  }
}

async function deleteFile({ file }) {
  const target = resolvePath(file);
  try {
    const stat = await fs.stat(target);
    if (stat.isDirectory()) {
      await fs.rm(target, { recursive: true, force: true });
    } else {
      await fs.unlink(target);
    }
    return { deleted: target, success: true };
  } catch (err) {
    return { deleted: target, error: err.message };
  }
}

module.exports = { listDir, readFile, writeFile, moveFile, deleteFile, resolvePath };
