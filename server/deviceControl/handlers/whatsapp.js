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
 * Automates sending WhatsApp messages on Windows (Desktop app or default browser WhatsApp Web)
 * Reuses already open WhatsApp window if present to avoid opening new web tabs.
 */
async function automateWindowsWhatsAppSend(recipient, messageText, number) {
  const b64Msg = Buffer.from(messageText, "utf8").toString("base64");
  const b64Recipient = recipient ? Buffer.from(recipient, "utf8").toString("base64") : "";

  // 1. If phone number is available, use universal WhatsApp deep links
  if (number) {
    const waProtocol = `whatsapp://send?phone=${number}&text=${encodeURIComponent(messageText)}`;
    const waWebUrl = `https://web.whatsapp.com/send?phone=${number}&text=${encodeURIComponent(messageText)}`;

    const script = `
Add-Type -AssemblyName System.Windows.Forms;
Add-Type -TypeDefinition '
using System;
using System.Runtime.InteropServices;
public class WinUtil {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
}';
$wsh = New-Object -ComObject WScript.Shell;
$focused = $wsh.AppActivate("WhatsApp");

if (-not $focused) {
  Start-Process '${waWebUrl}' -ErrorAction SilentlyContinue;
  Start-Sleep -Milliseconds 1500;
  $waProc = Get-Process | Where-Object {
    $_.MainWindowHandle -ne [IntPtr]::Zero -and (
      ($_.MainWindowTitle -and $_.MainWindowTitle -like '*WhatsApp*') -or
      ($_.ProcessName -like '*WhatsApp*')
    )
  } | Select-Object -First 1;
  if ($waProc) {
    if ([WinUtil]::IsIconic($waProc.MainWindowHandle)) {
      [WinUtil]::ShowWindowAsync($waProc.MainWindowHandle, 9);
    }
    [WinUtil]::SetForegroundWindow($waProc.MainWindowHandle);
    Start-Sleep -Milliseconds 500;
  }
}
Start-Sleep -Milliseconds 400;
[System.Windows.Forms.SendKeys]::SendWait('{ENTER}');
Write-Output "SENT_SUCCESS";
`;
    const output = await run("powershell.exe", ["-Sta", "-NoProfile", "-Command", script.replace(/\r?\n/g, " ")]).catch(() => "");
    return { sent: output.includes("SENT_SUCCESS"), openedWeb: true };
  }

  // 2. Named contact or active chat automation (Reuses existing WhatsApp window!)
  const script = `
Add-Type -AssemblyName System.Windows.Forms;
Add-Type -TypeDefinition '
using System;
using System.Runtime.InteropServices;
public class WinUtil {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
}';

$wsh = New-Object -ComObject WScript.Shell;
$focused = $wsh.AppActivate("WhatsApp");

if (-not $focused) {
  # Try finding browser or desktop process with WhatsApp title
  $waProc = Get-Process | Where-Object {
    $_.MainWindowHandle -ne [IntPtr]::Zero -and (
      ($_.MainWindowTitle -and $_.MainWindowTitle -like '*WhatsApp*') -or
      ($_.ProcessName -like '*WhatsApp*')
    )
  } | Select-Object -First 1;

  if ($waProc) {
    if ([WinUtil]::IsIconic($waProc.MainWindowHandle)) {
      [WinUtil]::ShowWindowAsync($waProc.MainWindowHandle, 9);
    } else {
      [WinUtil]::ShowWindowAsync($waProc.MainWindowHandle, 5);
    }
    [WinUtil]::SetForegroundWindow($waProc.MainWindowHandle);
    $focused = $true;
    Start-Sleep -Milliseconds 300;
  }
}

if (-not $focused) {
  # Only launch if WhatsApp is not open anywhere
  Start-Process "whatsapp:" -ErrorAction SilentlyContinue;
  Start-Sleep -Milliseconds 600;
  $waProc = Get-Process | Where-Object {
    $_.MainWindowHandle -ne [IntPtr]::Zero -and (
      ($_.MainWindowTitle -and $_.MainWindowTitle -like '*WhatsApp*') -or
      ($_.ProcessName -like '*WhatsApp*')
    )
  } | Select-Object -First 1;
  if ($waProc) {
    [WinUtil]::ShowWindowAsync($waProc.MainWindowHandle, 9);
    [WinUtil]::SetForegroundWindow($waProc.MainWindowHandle);
    Start-Sleep -Milliseconds 400;
  }
}

if ('${b64Recipient}'.Length -gt 0) {
  $rec = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${b64Recipient}'));
  # Clear existing dialogs/search
  [System.Windows.Forms.SendKeys]::SendWait('{ESC}');
  Start-Sleep -Milliseconds 150;
  # Open search bar in WhatsApp
  [System.Windows.Forms.SendKeys]::SendWait('^f');
  Start-Sleep -Milliseconds 250;
  Set-Clipboard -Value $rec;
  [System.Windows.Forms.SendKeys]::SendWait('^v');
  Start-Sleep -Milliseconds 750;
  # Select contact
  [System.Windows.Forms.SendKeys]::SendWait('{ENTER}');
  Start-Sleep -Milliseconds 450;
}

$msg = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${b64Msg}'));
Set-Clipboard -Value $msg;
Start-Sleep -Milliseconds 150;
[System.Windows.Forms.SendKeys]::SendWait('^v');
Start-Sleep -Milliseconds 300;
[System.Windows.Forms.SendKeys]::SendWait('{ENTER}');
Write-Output "SENT_SUCCESS";
`;

  const output = await run("powershell.exe", ["-Sta", "-NoProfile", "-Command", script.replace(/\r?\n/g, " ")]).catch(() => "");
  return {
    sent: output.includes("SENT_SUCCESS"),
    openedWeb: !output.includes("SENT_SUCCESS"),
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

  // 2. Windows PC: check for existing WhatsApp window and automate directly
  if (PLATFORM === "win32") {
    // Check if WhatsApp is already open
    const isAlreadyOpen = await system.focusExistingWindow("whatsapp");

    if (isAlreadyOpen) {
      // WhatsApp is already open — reuse existing window without opening any new browser tab!
      try {
        const result = await automateWindowsWhatsAppSend(recipient, message, number);
        if (result.sent) {
          return {
            to: recipient || "Active Chat",
            opened: "WhatsApp",
            message,
            status: "sent",
            reused: true,
            note: recipient
              ? `Message sent to ${recipient} in existing WhatsApp window, sir.`
              : `Message sent to active chat in existing WhatsApp window, sir.`,
          };
        }
      } catch (err) {
        console.warn("[whatsapp] Direct window automation note:", err.message);
      }
    }

    // If no specific recipient is given and WhatsApp wasn't open, open it
    const waUrl = number
      ? `https://web.whatsapp.com/send?phone=${number}&text=${encodeURIComponent(message)}`
      : `https://web.whatsapp.com/send?text=${encodeURIComponent(message)}`;

    if (!recipient && !number) {
      await system.openUrl({ url: waUrl });
      return {
        to: "WhatsApp",
        opened: "WhatsApp",
        url: waUrl,
        message,
        status: "drafted",
        note: `WhatsApp opened with your message written and ready, sir.`,
      };
    }

    try {
      const result = await automateWindowsWhatsAppSend(recipient, message, number);
      if (result.sent) {
        return {
          to: recipient || "Contact",
          opened: "WhatsApp",
          url: waUrl,
          message,
          status: "sent",
          note: `Message sent to ${recipient || "contact"}, sir.`,
        };
      }
    } catch (err) {
      console.warn("[whatsapp] Windows automation note:", err.message);
    }

    // Direct fallback: Open WhatsApp with message in browser/desktop
    await system.openUrl({ url: waUrl });
    return {
      to: recipient || "Selected Contact",
      opened: "WhatsApp",
      url: waUrl,
      message,
      status: "drafted",
      note: `Opened WhatsApp with message written and ready, sir.`,
    };
  }

  // 3. Fallback on Mac / Linux
  const waUrl = number
    ? `https://web.whatsapp.com/send?phone=${number}&text=${encodeURIComponent(message)}`
    : `https://web.whatsapp.com/send?text=${encodeURIComponent(message)}`;
  await system.openUrl({ url: waUrl });

  return { to: recipient || "contact", opened: "WhatsApp", url: waUrl, message, status: "drafted", method: "WhatsApp Web" };
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
