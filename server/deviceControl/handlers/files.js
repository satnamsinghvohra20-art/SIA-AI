const fs = require("fs/promises");
const path = require("path");

const DEVICE_ROOT = path.resolve(
  process.env.SIA_DEVICE_ROOT || path.join(__dirname, "..", "..", "..", "data", "device", "files")
);

function isWithinRoot(candidate, root = DEVICE_ROOT) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function resolvePath(inputPath, { allowRoot = true } = {}) {
  if (typeof inputPath !== "string" || !inputPath.trim()) {
    throw new Error("A file path inside the SIA device files folder is required.");
  }

  const target = path.resolve(DEVICE_ROOT, inputPath.trim());
  if (!isWithinRoot(target) || (!allowRoot && target === DEVICE_ROOT)) {
    throw new Error("File actions are limited to the configured SIA device files folder.");
  }
  return target;
}

async function realPathInsideRoot(target, { allowRoot = true, allowMissingLeaf = false } = {}) {
  await fs.mkdir(DEVICE_ROOT, { recursive: true });
  const realRoot = await fs.realpath(DEVICE_ROOT);

  let realTarget;
  try {
    realTarget = await fs.realpath(target);
  } catch (err) {
    if (!allowMissingLeaf || err.code !== "ENOENT") throw err;
    const realParent = await fs.realpath(path.dirname(target));
    realTarget = path.join(realParent, path.basename(target));
  }

  if (!isWithinRoot(realTarget, realRoot) || (!allowRoot && realTarget === realRoot)) {
    throw new Error("File actions are limited to the configured SIA device files folder.");
  }
  return realTarget;
}

async function listDir({ dir = "." } = {}) {
  try {
    const target = resolvePath(dir);
    const safeTarget = await realPathInsideRoot(target);
    const entries = await fs.readdir(safeTarget, { withFileTypes: true });
    return {
      dir: safeTarget,
      entries: entries.map((entry) => ({ name: entry.name, type: entry.isDirectory() ? "dir" : "file" })),
    };
  } catch (err) {
    return { error: err.message, entries: [] };
  }
}

async function readFile({ file } = {}) {
  try {
    const target = resolvePath(file, { allowRoot: false });
    const safeTarget = await realPathInsideRoot(target, { allowRoot: false });
    const content = await fs.readFile(safeTarget, "utf8");
    return { file: safeTarget, content: content.slice(0, 100_000) };
  } catch (err) {
    return { file, error: err.message };
  }
}

async function writeFile({ file, content = "" } = {}) {
  try {
    const target = resolvePath(file, { allowRoot: false });
    await fs.mkdir(path.dirname(target), { recursive: true });
    const safeParent = await realPathInsideRoot(path.dirname(target));
    const safeTarget = path.join(safeParent, path.basename(target));
    await realPathInsideRoot(safeTarget, { allowRoot: false, allowMissingLeaf: true });
    await fs.writeFile(safeTarget, String(content), "utf8");
    return { file: safeTarget, success: true, bytesWritten: Buffer.byteLength(String(content), "utf8") };
  } catch (err) {
    return { file, error: err.message };
  }
}

async function moveFile({ from, to } = {}) {
  try {
    const source = resolvePath(from, { allowRoot: false });
    const destination = resolvePath(to, { allowRoot: false });
    const safeSource = await realPathInsideRoot(source, { allowRoot: false });
    await fs.mkdir(path.dirname(destination), { recursive: true });
    const safeParent = await realPathInsideRoot(path.dirname(destination));
    const safeDestination = path.join(safeParent, path.basename(destination));
    await realPathInsideRoot(safeDestination, { allowRoot: false, allowMissingLeaf: true });
    await fs.rename(safeSource, safeDestination);
    return { from: safeSource, to: safeDestination, success: true };
  } catch (err) {
    return { from, to, error: err.message };
  }
}

async function deleteFile({ file } = {}) {
  try {
    const target = resolvePath(file, { allowRoot: false });
    const safeTarget = await realPathInsideRoot(target, { allowRoot: false });
    const stat = await fs.stat(safeTarget);
    if (stat.isDirectory()) await fs.rm(safeTarget, { recursive: true, force: true });
    else await fs.unlink(safeTarget);
    return { deleted: safeTarget, success: true };
  } catch (err) {
    return { file, error: err.message };
  }
}

module.exports = { listDir, readFile, writeFile, moveFile, deleteFile, resolvePath, DEVICE_ROOT };
