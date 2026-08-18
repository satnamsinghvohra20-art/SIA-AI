const { execFile } = require("child_process");
const os = require("os");
const system = require("./system");

/**
 * UI CONTROL HANDLERS
 * --------------------
 * This is the piece that lets voice commands drive ANY app, not just the
 * ones with a partner API (WhatsApp/Instagram/calls). Instead of talking
 * to an app's API, this drives the operating system directly the same way
 * a person would — click at a point, type text, press a key, scroll.
 *
 * Windows -> PowerShell (System.Windows.Forms.SendKeys + cursor APIs)
 * macOS   -> AppleScript via `osascript` ("System Events")
 * Linux   -> xdotool (install: apt install xdotool)
 *
 * These are marked "risky" in actionRegistry.js on purpose: a click/type
 * anywhere on screen can do real things in any app (send a message, delete
 * something, submit a form). Every call still pauses for approval unless
 * explicitly confirmed, same as the rest of device control.
 */

const PLATFORM = os.platform();

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
    const script = `
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x},${y})
Add-Type -TypeDefinition '
using System;
using System.Runtime.InteropServices;
public class Click {
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint data, int extra);
}';
for ($i=0; $i -lt ${clicks}; $i++) {
  [Click]::mouse_event(0x0002,0,0,0,0); [Click]::mouse_event(0x0004,0,0,0,0);
}`;
    await run("powershell.exe", ["-NoProfile", "-Command", script]);
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
    // SendKeys special-chars need escaping
    const escaped = text.replace(/([+^%~(){}[\]])/g, "{$1}");
    const script = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("${escaped.replace(/"/g, '`"')}")`;
    await run("powershell.exe", ["-NoProfile", "-Command", script]);
  } else if (PLATFORM === "darwin") {
    const escaped = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    await run("osascript", ["-e", `tell application "System Events" to keystroke "${escaped}"`]);
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
    await run("powershell.exe", ["-NoProfile", "-Command", `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("${seq}")`]);
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
      const mainKey = parts.pop();
      const mods = parts.map((m) => ({ cmd: "command down", ctrl: "control down", alt: "option down", shift: "shift down" }[m.toLowerCase()])).filter(Boolean);
      const using = mods.length ? ` using {${mods.join(", ")}}` : "";
      await run("osascript", ["-e", `tell application "System Events" to keystroke "${mainKey}"${using}`]);
    }
  } else {
    await run("xdotool", ["key", key.replace(/\+/g, "+")]);
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
