const { execFile } = require("child_process");
const os = require("os");
const mobileBridge = require("../mobileBridge");
const mobile = require("./mobile");
const system = require("./system");
const screenReader = require("./screenReader");
const { tapLabel } = require("./mobileUiHelpers");

const PLATFORM = os.platform();

function run(cmd, args = []) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 10_000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr?.toString() || err.message));
      resolve(stdout?.toString().trim() || "");
    });
  });
}

function toWaMeNumber(to) {
  if (!to) return null;
  const digits = String(to).replace(/[^\d]/g, "");
  return digits.length >= 7 ? digits : null;
}

/**
 * Automates sending WhatsApp messages on Windows (Desktop app or Edge WhatsApp Web)
 */
async function automateWindowsWhatsAppSend(recipient, messageText, number) {
  const b64Msg = Buffer.from(messageText, "utf8").toString("base64");
  const b64Recipient = recipient ? Buffer.from(recipient, "utf8").toString("base64") : "";

  const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition '
using System;
using System.Runtime.InteropServices;
public class WinUtil {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
}';

# 1. Look for existing WhatsApp Desktop or Edge WhatsApp Web window
$waProc = Get-Process | Where-Object {
  $_.MainWindowHandle -ne [IntPtr]::Zero -and (
    ($_.MainWindowTitle -and $_.MainWindowTitle -like '*WhatsApp*') -or
    ($_.ProcessName -like '*WhatsApp*')
  )
} | Select-Object -First 1

$isEdge = $false
if (-not $waProc) {
  # Look for Edge with WhatsApp Web
  $edgeProc = Get-Process | Where-Object {
    $_.MainWindowHandle -ne [IntPtr]::Zero -and (
      ($_.MainWindowTitle -and $_.MainWindowTitle -like '*WhatsApp*') -or
      ($_.ProcessName -eq 'msedge' -and $_.MainWindowTitle -like '*WhatsApp*')
    )
  } | Select-Object -First 1
  if ($edgeProc) {
    $waProc = $edgeProc
    $isEdge = $true
  }
}

if ($waProc) {
  if ([WinUtil]::IsIconic($waProc.MainWindowHandle)) {
    [WinUtil]::ShowWindowAsync($waProc.MainWindowHandle, 9);
  }
  [WinUtil]::SetForegroundWindow($waProc.MainWindowHandle);
  Start-Sleep -Milliseconds 400
} else {
  # WhatsApp not open -> launch in default Edge browser
  Start-Process "msedge.exe" "https://web.whatsapp.com"
  Start-Sleep -Milliseconds 2500
  Write-Output "OPENED_EDGE"
  return
}

# 2. Search contact if name provided
if ('${b64Recipient}'.Length -gt 0) {
  $recBytes = [Convert]::FromBase64String('${b64Recipient}')
  $recDecoded = [System.Text.Encoding]::UTF8.GetString($recBytes)
  
  # Focus search bar
  if ($isEdge) {
    [System.Windows.Forms.SendKeys]::SendWait('^%{/}')
  } else {
    [System.Windows.Forms.SendKeys]::SendWait('^f')
  }
  Start-Sleep -Milliseconds 350
  
  [System.Windows.Forms.Clipboard]::SetText($recDecoded)
  Start-Sleep -Milliseconds 100
  [System.Windows.Forms.SendKeys]::SendWait('^v')
  Start-Sleep -Milliseconds 800
  [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
  Start-Sleep -Milliseconds 600
}

# 3. Paste message and hit Enter
$msgBytes = [Convert]::FromBase64String('${b64Msg}')
$msgDecoded = [System.Text.Encoding]::UTF8.GetString($msgBytes)
[System.Windows.Forms.Clipboard]::SetText($msgDecoded)
Start-Sleep -Milliseconds 150
[System.Windows.Forms.SendKeys]::SendWait('^v')
Start-Sleep -Milliseconds 350
[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
Write-Output "SENT_SUCCESS"
`;

  const output = await run("powershell.exe", ["-NoProfile", "-Command", script]).catch(() => "");
  return {
    sent: output.includes("SENT_SUCCESS"),
    openedEdge: output.includes("OPENED_EDGE"),
  };
}

async function sendWhatsappMessage({ to, message }, context = {}) {
  if (!message) throw new Error("message text is required");

  const number = to ? toWaMeNumber(to) : null;
  const recipient = to ? String(to).trim() : "";

  // 1. If mobile companion phone is connected
  if (context.sessionId && mobileBridge.isDeviceConnected(context.sessionId)) {
    const mobileUrl = number
      ? `https://wa.me/${number}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    await mobile.openUrl({ url: mobileUrl }, context);
    try {
      await tapLabel(context, ["Send"], { attempts: 8, intervalMs: 800 });
    } catch (_) {}
    return { to: recipient || "recipient", message, status: "sent", method: "on-device WhatsApp" };
  }

  // 2. Windows PC: execute automated send or open with written message
  if (PLATFORM === "win32") {
    // If no specific recipient is given, open WhatsApp Web with the message pre-filled directly
    if (!recipient && !number) {
      const waUrl = `https://web.whatsapp.com/send?text=${encodeURIComponent(message)}`;
      await system.openUrl({ url: waUrl, browser: "edge" });
      return {
        to: "WhatsApp Web",
        message,
        status: "drafted",
        note: `WhatsApp Web opened in Microsoft Edge with your message written and ready.`,
      };
    }

    try {
      const result = await automateWindowsWhatsAppSend(recipient, message, number);
      if (result.sent) {
        return {
          to: recipient || "Contact",
          message,
          status: "sent",
          note: `Message sent to ${recipient || "contact"}.`,
        };
      }
      if (result.openedEdge) {
        return {
          to: recipient || "Contact",
          message,
          status: "drafted",
          note: `Opened WhatsApp Web in Microsoft Edge with message for ${recipient || "contact"}.`,
        };
      }
    } catch (err) {
      console.warn("[whatsapp] Windows automation note:", err.message);
    }

    // Direct fallback: Open WhatsApp Web in Edge
    const waUrl = number
      ? `https://web.whatsapp.com/send?phone=${number}&text=${encodeURIComponent(message)}`
      : `https://web.whatsapp.com/send?text=${encodeURIComponent(message)}`;

    await system.openUrl({ url: waUrl, browser: "edge" });
    return {
      to: recipient || "Selected Contact",
      message,
      status: "drafted",
      note: `Opened WhatsApp Web in Microsoft Edge with message written and ready.`,
    };
  }

  // 3. Fallback on Mac / Linux
  const waUrl = number
    ? `https://web.whatsapp.com/send?phone=${number}&text=${encodeURIComponent(message)}`
    : `https://web.whatsapp.com/send?text=${encodeURIComponent(message)}`;
  await system.openUrl({ url: waUrl, browser: "edge" });

  return { to: recipient || "contact", message, status: "drafted", method: "WhatsApp Web" };
}

/**
 * Reads WhatsApp messages and notifications from active screen or WhatsApp window
 */
async function readWhatsappMessages({ question = "Read recent WhatsApp messages and chats" } = {}) {
  return await screenReader.readScreenMessages({
    targetApp: "whatsapp",
    question: question || "Read recent WhatsApp chat messages, sender names, and contents.",
  });
}

module.exports = {
  sendWhatsappMessage,
  readWhatsappMessages,
};
