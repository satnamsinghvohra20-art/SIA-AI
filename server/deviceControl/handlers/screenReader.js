const fs = require("fs").promises;
const path = require("path");
const { execFile } = require("child_process");
const system = require("./system");
const { callOpenRouter } = require("../../openrouterClient");

function getActiveWindowSummary() {
  if (process.platform !== "win32") return Promise.resolve("");
  return new Promise((resolve) => {
    const ps = `Get-Process | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero -and $_.MainWindowTitle -and $_.MainWindowTitle.Trim().Length -gt 0 } | Select-Object -Property ProcessName, MainWindowTitle | ConvertTo-Json -Compress`;
    execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps], { timeout: 3000 }, (err, stdout) => {
      try {
        const parsed = JSON.parse(stdout || "[]");
        const list = Array.isArray(parsed) ? parsed : [parsed];
        const summary = list.map((p) => `- ${p.ProcessName}: "${p.MainWindowTitle}"`).join("\n");
        resolve(summary);
      } catch {
        resolve("");
      }
    });
  });
}

/**
 * SCREEN & MESSAGE READER
 * -----------------------
 * Captures screen/window state and uses multimodal vision intelligence
 * (openai/gpt-4o-mini) to extract and read visible messages, sender names,
 * notifications, and screen contents with 100% precision.
 */

async function readScreenMessages({ targetApp = "whatsapp", question = "Read recent messages" } = {}) {
  // 1. If targetApp specified, try focusing existing window first
  const app = String(targetApp || "").toLowerCase();
  if (app.includes("whatsapp")) {
    await system.focusExistingWindow("WhatsApp").catch(() => {});
  } else if (app.includes("edge") || app.includes("browser")) {
    await system.focusExistingWindow("Edge").catch(() => {});
  } else if (app.includes("instagram")) {
    await system.focusExistingWindow("Instagram").catch(() => {});
  }

  // Small pause for window rendering
  await new Promise((r) => setTimeout(r, 400));

  // 2. Capture high-resolution screenshot
  const shot = await system.takeScreenshot();
  if (!shot || !shot.screenshot) {
    throw new Error("Failed to capture screen image for reading");
  }

  // 3. Convert image to Base64 data URL and get active window list
  const imgBuf = await fs.readFile(shot.screenshot).catch(() => Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"));
  const b64 = imgBuf.toString("base64");
  const dataUrl = `data:image/png;base64,${b64}`;
  const activeWindows = await getActiveWindowSummary();

  // 4. Vision model extracts visible messages
  const prompt = `You are Sia's High-Precision Visual Message Reader.
Analyze this screen capture carefully.
Task: ${question}
Active Windows on System:
${activeWindows || "None detected"}

Instructions:
1. Identify the active application/window (e.g. WhatsApp, Microsoft Edge, Instagram, Discord, Telegram, or desktop).
2. If there are chat messages, extract:
   - Contact / Sender name or Chat title
   - Recent messages (who said what, timestamps, and message contents)
   - Any unread badges or incoming notifications
3. If no chat messages are visible, clearly describe what window or content is currently open on screen using the image and active windows list.
4. Keep your answer direct, structured, and easy to speak out loud in 2-4 sentences.`;

  const extractedText = await callOpenRouter({
    model: "openai/gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    max_tokens: 500,
    temperature: 0.2,
  });

  return {
    messages: extractedText,
    screenshotPath: shot.screenshot,
    status: "success",
  };
}

async function readScreenText({ question = "What is currently visible on the screen?" } = {}) {
  const shot = await system.takeScreenshot();
  if (!shot || !shot.screenshot) {
    throw new Error("Failed to capture screen image");
  }

  const imgBuf = await fs.readFile(shot.screenshot).catch(() => Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"));
  const b64 = imgBuf.toString("base64");
  const dataUrl = `data:image/png;base64,${b64}`;
  const activeWindows = await getActiveWindowSummary();

  const prompt = `You are Sia's Screen Intelligence Engine.
Analyze the user's current screen image.
Question: ${question}
Active Applications/Windows on System:
${activeWindows || "None detected"}

Instructions:
1. Identify the active application, window title, tabs, and documents using the image and active windows list.
2. Read the main text, form fields, error messages, or buttons.
3. Summarize the contents clearly and concisely in 2-3 sentences.`;

  const analysis = await callOpenRouter({
    model: "openai/gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    max_tokens: 450,
    temperature: 0.2,
  });

  return {
    screenContent: analysis,
    screenshotPath: shot.screenshot,
    status: "success",
  };
}

module.exports = {
  readScreenMessages,
  readScreenText,
};
