const { execFile, spawn } = require("child_process");
const os = require("os");
const system = require("./system");

const PLATFORM = os.platform();

function launchDetached(cmd, args = []) {
  return new Promise((resolve) => {
    try {
      const child = spawn(cmd, args, {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });
      child.unref();
      setTimeout(resolve, 200);
    } catch (_) {
      resolve();
    }
  });
}

function run(cmd, args = []) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 10_000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr?.toString() || err.message));
      resolve(stdout?.toString().trim() || "");
    });
  });
}

async function click({ x, y, button = "left", double = false }) {
  if (typeof x !== "number" || typeof y !== "number") {
    throw new Error("x and y (numbers) are required");
  }

  if (PLATFORM === "win32") {
    const clicks = double ? 2 : 1;
    const script = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x},${y}); Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Click { [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint data, int extra); }'; for ($i=0; $i -lt ${clicks}; $i++) { [Click]::mouse_event(0x0002,0,0,0,0); [Click]::mouse_event(0x0004,0,0,0,0); }`;
    await launchDetached("powershell.exe", ["-NoProfile", "-Command", script]);
  } else if (PLATFORM === "darwin") {
    const clickCount = double ? 2 : 1;
    const script = `tell application "System Events" to ${clickCount === 2 ? "double " : ""}click at {${x}, ${y}}`;
    await run("osascript", ["-e", script]);
  } else {
    const args = ["mousemove", String(x), String(y)];
    await run("xdotool", args);
    await run("xdotool", ["click", "--clearmodifiers", double ? "--repeat" : "", "1"].filter(Boolean));
    if (double) await run("xdotool", ["click", "1"]);
  }
  return { clicked: { x, y, button, double } };
}

async function typeText({ text }) {
  if (typeof text !== "string" || !text.length) throw new Error("text is required");

  if (PLATFORM === "win32") {
    const b64 = Buffer.from(text, "utf8").toString("base64");
    const script = `Add-Type -AssemblyName System.Windows.Forms; $bytes = [Convert]::FromBase64String('${b64}'); $decoded = [System.Text.Encoding]::UTF8.GetString($bytes); Set-Clipboard -Value $decoded; Start-Sleep -Milliseconds 150; [System.Windows.Forms.SendKeys]::SendWait('^v');`;
    await launchDetached("powershell.exe", ["-Sta", "-NoProfile", "-Command", script]);
  } else if (PLATFORM === "darwin") {
    const escaped = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const script = `set the clipboard to "${escaped}"\ntell application "System Events" to keystroke "v" using {command down}`;
    await run("osascript", ["-e", script]).catch(async () => {
      await run("osascript", ["-e", `tell application "System Events" to keystroke "${escaped}"`]);
    });
  } else {
    await run("xdotool", ["type", "--clearmodifiers", "--", text]);
  }
  return { typed: text };
}

// Named keys -> platform key syntax, e.g. "enter", "tab", "escape", "cmd+c"
async function pressKey({ key }) {
  if (typeof key !== "string" || !key.length) throw new Error("key is required");

  if (PLATFORM === "win32") {
    const map = { enter: "{ENTER}", tab: "{TAB}", escape: "{ESC}", backspace: "{BACKSPACE}", up: "{UP}", down: "{DOWN}", left: "{LEFT}", right: "{RIGHT}" };
    const seq = map[key.toLowerCase()] || `{${key}}`;
    await launchDetached("powershell.exe", ["-NoProfile", "-Command", `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("${seq}")`]);
  } else if (PLATFORM === "darwin") {
    const map = { enter: "return", escape: "escape", backspace: "delete", tab: "tab", up: "up arrow", down: "down arrow", left: "left arrow", right: "right arrow" };
    const named = map[key.toLowerCase()];
    if (named) {
      await run("osascript", ["-e", `tell application "System Events" to key code (key code of "${named}")`]).catch(async () => {
        await run("osascript", ["-e", `tell application "System Events" to keystroke ${named === "return" ? "return" : `"${key}"`}`]);
      });
    } else {
      // combo like "cmd+c"
      const parts = key.split("+");
      const baseKey = parts[parts.length - 1];
      const modifiers = parts.slice(0, -1).map((m) => {
        if (m === "cmd" || m === "command") return "command down";
        if (m === "ctrl" || m === "control") return "control down";
        if (m === "alt" || m === "option") return "option down";
        if (m === "shift") return "shift down";
        return "";
      }).filter(Boolean);
      const modStr = modifiers.length ? ` using {${modifiers.join(", ")}}` : "";
      await run("osascript", ["-e", `tell application "System Events" to keystroke "${baseKey}"${modStr}`]);
    }
  } else {
    await run("xdotool", ["key", "--clearmodifiers", key]);
  }
  return { pressed: key };
}

async function scroll({ direction = "down", amount = 3 }) {
  const dir = String(direction).toLowerCase();
  if (PLATFORM === "win32") {
    const delta = dir === "up" ? 120 * amount : -120 * amount;
    const script = `Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class Scroll{[DllImport("user32.dll")]public static extern void mouse_event(uint f,uint dx,uint dy,uint data,int extra);}'; [Scroll]::mouse_event(0x0800,0,0,${delta},0)`;
    await run("powershell.exe", ["-NoProfile", "-Command", script]);
  } else if (PLATFORM === "darwin") {
    const clicks = dir === "up" ? amount : -amount;
    await run("osascript", ["-e", `tell application "System Events" to scroll ${clicks}`]).catch(() => {});
  } else {
    const button = dir === "up" ? "4" : "5";
    for (let i = 0; i < amount; i++) await run("xdotool", ["click", button]);
  }
  return { scrolled: { direction: dir, amount } };
}

// Returns a fresh screenshot path. The agent loop's model reads it via the
// vision category on the next turn — this handler doesn't do OCR itself,
// it just captures state so the model can decide what to click next.
async function readScreen() {
  const shot = await system.takeScreenshot();
  return { screenshot: shot.screenshot, note: "Screenshot captured. Route it through the vision model to decide the next click/type target." };
}

module.exports = { click, typeText, pressKey, scroll, readScreen };
