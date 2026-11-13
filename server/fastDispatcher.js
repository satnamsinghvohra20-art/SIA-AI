const fs = require("fs/promises");
const path = require("path");
const system = require("./deviceControl/handlers/system");
const whatsapp = require("./deviceControl/handlers/whatsapp");
const uiControl = require("./deviceControl/handlers/uiControl");
const files = require("./deviceControl/handlers/files");
const scripts = require("./deviceControl/handlers/scripts");

/**
 * FAST-PATH UNIVERSAL TASK DISPATCHER (<50ms Execution)
 * -----------------------------------------------------
 * Directly executes deterministic owner commands across apps, websites,
 * files/folders, shell/terminal, UI typing/keys/scrolling, media, volume,
 * brightness, clipboard, WhatsApp, and phone calls without LLM delay.
 */

function cleanCommandRaw(text) {
  return (text || "")
    .trim()
    .replace(/^(sia|hey\s+sia|hi\s+sia|ok\s+sia|jarvis|hey\s+jarvis)[,\s:]*/i, "")
    .replace(/[.?!]+$/g, "")
    .trim();
}

function cleanCommand(text) {
  return cleanCommandRaw(text).toLowerCase();
}

function stepSucceeded(result) {
  if (!result || typeof result !== "object") return true;
  if (result.ok === false || result.success === false) return false;
  if (typeof result.error === "string" && result.error.length > 0) return false;
  return true;
}

async function executeSingleIntent(rawInput) {
  const raw = (rawInput || "").trim();
  const text = raw.toLowerCase();
  if (!text) return null;

  // 1A. "open <app> and type <text>"
  const openAndTypeMatch = raw.match(/^(?:open|launch|switch to|start)\s+([a-zA-Z0-9.\s_-]+?)\s+and\s+type\s+(.+)$/i);
  if (openAndTypeMatch) {
    const appName = openAndTypeMatch[1].trim();
    const toType = openAndTypeMatch[2].trim().replace(/^["']|["']$/g, "");
    const openRes = await system.openApp({ app: appName });
    await new Promise((r) => setTimeout(r, 550));
    const typeRes = await uiControl.typeText({ text: toType });
    return {
      action: "open_and_type",
      params: { app: appName, text: toType },
      summary: `Opened ${appName} and typed "${toType.slice(0, 60)}"`,
      result: { open: openRes, type: typeRes },
    };
  }

  // 1B. "open <app> and (place order for|order|buy|purchase|search|find|play) <item>"
  const openAndActionMatch = raw.match(/^(?:open|launch|go to)\s+([a-zA-Z0-9.\s]+?)\s+and\s+(?:place\s+order\s+for|order|buy|purchase|shop\s+for|search(?:\s+for)?|find|look\s+up|play)\s+(.+)$/i);
  if (openAndActionMatch) {
    const platform = openAndActionMatch[1].trim().toLowerCase();
    const item = openAndActionMatch[2].trim();
    const res = await system.openApp({ app: platform, query: item });
    const prettyPlatform = platform.charAt(0).toUpperCase() + platform.slice(1);
    return {
      action: "open_app",
      params: { app: platform, query: item },
      summary: `Opened ${prettyPlatform} with ${item} ready on screen`,
      result: res,
    };
  }

  // 2A. Flexible WhatsApp: "send <msg> to <recipient> on whatsapp" / "tell <recipient> on whatsapp <msg>"
  const waMsgFirst = raw.match(/^(?:send|text|message|tell)\s+(.+?)\s+to\s+([a-zA-Z0-9\s+._-]+?)\s+on\s+whatsapp$/i);
  if (waMsgFirst) {
    const message = waMsgFirst[1].trim().replace(/^["']|["']$/g, "");
    const to = waMsgFirst[2].trim();
    const res = await whatsapp.sendWhatsappMessage({ to, message });
    return { action: "send_whatsapp_message", params: { to, message }, summary: `Dispatched WhatsApp message to ${to}`, result: res };
  }
  const waTellOn = raw.match(/^(?:tell|message|text)\s+([a-zA-Z0-9\s+._-]+?)\s+on\s+whatsapp\s*[:,-]?\s*(?:saying|that)?\s*(.+)$/i);
  if (waTellOn) {
    const to = waTellOn[1].trim();
    const message = waTellOn[2].trim().replace(/^["']|["']$/g, "");
    const res = await whatsapp.sendWhatsappMessage({ to, message });
    return { action: "send_whatsapp_message", params: { to, message }, summary: `Dispatched WhatsApp message to ${to}`, result: res };
  }

  // 2B. Direct Messaging (WhatsApp, Messages, Text):
  const waMatch = raw.match(/^(?:send\s+(?:a\s+)?(?:whatsapp|message|text|msg)(?:\s+to)?|(?:whatsapp|message|text))\s+([a-zA-Z0-9\s+]+?)(?:\s+(?:message|msg|saying|text|that)?\s*[:,-]?\s*(.+))?$/i);
  if (waMatch && !text.startsWith("send email") && !/^(?:message|text)\s+(?:file|folder)/i.test(text)) {
    const to = waMatch[1].trim();
    const message = waMatch[2] ? waMatch[2].trim() : "Hello";
    const res = await whatsapp.sendWhatsappMessage({ to, message });
    return {
      action: "send_whatsapp_message",
      params: { to, message },
      summary: `Dispatched message to ${to}`,
      result: res,
    };
  }

  // 3. File & Folder Operations (Unrestricted Host Filesystem)
  // 3a. Create / write file: "create file X with Y", "write 'Y' to file X", "save Y in X"
  const createFileWithMatch = raw.match(/^(?:create|write|make|save)\s+(?:a\s+)?file\s+([^\s]+(?:\s+on\s+(?:desktop|downloads|documents))?)\s+(?:with(?:\s+content|\s+text)?|containing|saying)\s+(.+)$/i);
  if (createFileWithMatch) {
    let targetFile = createFileWithMatch[1].trim();
    const onFolder = targetFile.match(/^(.+?)\s+on\s+(desktop|downloads|documents)$/i);
    if (onFolder) {
      targetFile = path.join(files.resolvePath(onFolder[2]), onFolder[1].trim());
    }
    const content = createFileWithMatch[2].trim().replace(/^["']|["']$/g, "");
    const res = await files.writeFile({ file: targetFile, content });
    return {
      action: "write_file",
      params: { file: res.file || targetFile, content },
      summary: res.success ? `Created file ${res.file}` : `Failed to create file: ${res.error}`,
      result: res,
    };
  }

  const writeToFileMatch = raw.match(/^(?:write|save)\s+(.+?)\s+(?:to|in|into)\s+(?:file\s+)?([a-zA-Z0-9_.\-\\/:~]+)$/i);
  if (writeToFileMatch && !text.includes("clipboard")) {
    const content = writeToFileMatch[1].trim().replace(/^["']|["']$/g, "");
    const targetFile = writeToFileMatch[2].trim();
    const res = await files.writeFile({ file: targetFile, content });
    return {
      action: "write_file",
      params: { file: res.file || targetFile, content },
      summary: res.success ? `Wrote ${res.bytesWritten} bytes to ${res.file}` : `Failed to write file: ${res.error}`,
      result: res,
    };
  }

  const createEmptyFileMatch = raw.match(/^(?:create|make|touch)\s+(?:a\s+)?file\s+(?:named\s+|called\s+)?([^\s]+)(?:\s+on\s+(desktop|downloads|documents))?$/i);
  if (createEmptyFileMatch) {
    let targetFile = createEmptyFileMatch[1].trim();
    if (createEmptyFileMatch[2]) {
      targetFile = path.join(files.resolvePath(createEmptyFileMatch[2]), targetFile);
    }
    const res = await files.writeFile({ file: targetFile, content: "" });
    return {
      action: "write_file",
      params: { file: res.file || targetFile, content: "" },
      summary: res.success ? `Created file ${res.file}` : `Failed to create file: ${res.error}`,
      result: res,
    };
  }

  // 3b. Create folder: "create folder X", "mkdir X"
  const mkdirMatch = raw.match(/^(?:create|make)\s+(?:a\s+)?(?:folder|directory|dir)\s+(?:named\s+|called\s+)?([^\s]+)(?:\s+on\s+(desktop|downloads|documents))?$/i);
  if (mkdirMatch) {
    let folderPath = files.resolvePath(mkdirMatch[1].trim());
    if (mkdirMatch[2]) {
      folderPath = path.join(files.resolvePath(mkdirMatch[2]), mkdirMatch[1].trim());
    }
    await fs.mkdir(folderPath, { recursive: true });
    return {
      action: "create_folder",
      params: { dir: folderPath },
      summary: `Created folder ${folderPath}`,
      result: { dir: folderPath, success: true },
    };
  }

  // 3c. Read file: "read file X"
  const readFileMatch = raw.match(/^(?:read|cat|show|view)\s+(?:the\s+)?file\s+(.+)$/i);
  if (readFileMatch) {
    const filePath = readFileMatch[1].trim().replace(/^["']|["']$/g, "");
    const res = await files.readFile({ file: filePath });
    const preview = res.content ? res.content.slice(0, 600) : res.error;
    return {
      action: "read_file",
      params: { file: filePath },
      summary: res.error ? `Could not read ${filePath}: ${res.error}` : `Contents of ${res.file}:\n\`\`\`\n${preview}\n\`\`\``,
      result: res,
    };
  }

  // 3d. List directory: "list files in X", "list dir X", "show files in X"
  const listDirMatch = raw.match(/^(?:list|show)\s+(?:all\s+)?(?:files|folders|contents|dir|directory)(?:\s+in)?\s*(.*)$/i);
  if (listDirMatch && !text.includes("running apps") && !text.includes("open windows")) {
    const dirArg = (listDirMatch[1] || ".").trim() || ".";
    const res = await files.listDir({ dir: dirArg });
    const names = (res.entries || []).slice(0, 20).map((e) => `${e.type === "dir" ? "[DIR]" : "[FILE]"} ${e.name}`).join(", ");
    return {
      action: "list_dir",
      params: { dir: dirArg },
      summary: res.error ? `Failed to list ${dirArg}: ${res.error}` : `${res.dir} (${res.entries.length} items): ${names || "empty"}`,
      result: res,
    };
  }

  // 3e. Move / rename file
  const moveFileMatch = raw.match(/^(?:move|rename)\s+(?:file\s+)?([^\s]+)\s+to\s+([^\s]+)$/i);
  if (moveFileMatch) {
    const res = await files.moveFile({ from: moveFileMatch[1], to: moveFileMatch[2] });
    return {
      action: "move_file",
      params: { from: moveFileMatch[1], to: moveFileMatch[2] },
      summary: res.success ? `Moved ${res.from} to ${res.to}` : `Move failed: ${res.error}`,
      result: res,
    };
  }

  // 3f. Delete file / folder
  const delFileMatch = raw.match(/^(?:delete|remove)\s+(?:the\s+)?(?:file|folder|directory)\s+(.+)$/i);
  if (delFileMatch) {
    const target = delFileMatch[1].trim().replace(/^["']|["']$/g, "");
    const res = await files.deleteFile({ file: target });
    return {
      action: "delete_file",
      params: { file: target },
      summary: res.success ? `Deleted ${res.deleted}` : `Delete failed: ${res.error}`,
      result: res,
    };
  }

  // 4. Direct Shell / Terminal / System Queries
  const cmdMatch = raw.match(/^(?:run\s+command|run\s+terminal|execute\s+command|execute|exec|run\s+shell|powershell|cmd)\s+(.+)$/i);
  if (cmdMatch) {
    const cmd = cmdMatch[1].trim();
    const res = await scripts.runCommand({ command: cmd });
    const outputPreview = res.stdout ? res.stdout.slice(0, 400) : (res.stderr ? res.stderr.slice(0, 400) : "Done");
    return {
      action: "run_command",
      params: { command: cmd },
      summary: res.success ? `Executed \`${cmd}\`:\n\`\`\`\n${outputPreview}\n\`\`\`` : `Command \`${cmd}\` failed: ${res.stderr || res.error}`,
      result: res,
    };
  }

  const quickShellMap = [
    { re: /^(?:check\s+)?(?:git\s+status)$/i, cmd: "git status -sb" },
    { re: /^(?:check\s+)?(?:git\s+log)$/i, cmd: "git log -n 5 --oneline" },
    { re: /^(?:check\s+my\s+ip|my\s+ip|ipconfig|check\s+ip)$/i, cmd: process.platform === "win32" ? "ipconfig" : "ifconfig || ip addr" },
    { re: /^(?:check\s+disk(?:\s+space)?|disk\s+space)$/i, cmd: process.platform === "win32" ? "Get-PSDrive -PSProvider FileSystem | Select-Object Name,@{N='UsedGB';E={[math]::Round($_.Used/1GB,1)}},@{N='FreeGB';E={[math]::Round($_.Free/1GB,1)}}" : "df -h" },
    { re: /^(?:whoami|hostname)$/i, cmd: text },
  ];
  for (const item of quickShellMap) {
    if (item.re.test(text)) {
      const res = await scripts.runCommand({ command: item.cmd });
      const out = (res.stdout || res.stderr || "Done").trim().slice(0, 500);
      return {
        action: "run_command",
        params: { command: item.cmd },
        summary: `Executed \`${item.cmd}\`:\n\`\`\`\n${out}\n\`\`\``,
        result: res,
      };
    }
  }

  const pingMatch = raw.match(/^ping\s+([a-zA-Z0-9.\-:]+)$/i);
  if (pingMatch) {
    const host = pingMatch[1].trim();
    const cmd = process.platform === "win32" ? `ping -n 2 ${host}` : `ping -c 2 ${host}`;
    const res = await scripts.runCommand({ command: cmd });
    return {
      action: "run_command",
      params: { command: cmd },
      summary: `Ping ${host}:\n\`\`\`\n${(res.stdout || res.stderr || "").trim().slice(0, 400)}\n\`\`\``,
      result: res,
    };
  }

  // 5. "play <song/video> on youtube / spotify" or "play <song>"
  const playMatch = raw.match(/^(?:play|listen to)\s+(.+?)(?:\s+on\s+(youtube|spotify))?$/i);
  if (playMatch && !/^(?:play\/pause|play or pause)$/i.test(text)) {
    const query = playMatch[1].trim();
    const targetApp = (playMatch[2] || (query.toLowerCase().includes("song") || query.toLowerCase().includes("track") ? "spotify" : "youtube")).toLowerCase();
    const res = await system.openApp({ app: targetApp, query });
    return {
      action: "open_app",
      params: { app: targetApp, query },
      summary: `Playing ${query} on ${targetApp === "spotify" ? "Spotify" : "YouTube"}`,
      result: res,
    };
  }

  // 6. "order/buy/purchase/place order for <item> on flipkart/amazon" or "order/buy <item>"
  const buyMatch = raw.match(/^(?:place\s+order\s+for|order|buy|purchase|shop\s+for)\s+(.+?)(?:\s+(?:on|from|in)\s+([a-zA-Z0-9\s]+))?$/i);
  if (buyMatch) {
    const item = buyMatch[1].trim();
    const platform = (buyMatch[2] || "flipkart").toLowerCase().trim();
    const res = await system.openApp({ app: platform, query: item });
    const prettyPlatform = platform.charAt(0).toUpperCase() + platform.slice(1);
    return {
      action: "open_app",
      params: { app: platform, query: item },
      summary: `Opened ${prettyPlatform} with ${item} ready on screen`,
      result: res,
    };
  }

  // 7. "search for <query> on <engine/site>" or "search <query>" or "google <query>"
  const searchMatch = raw.match(/^(?:search(?:\s+for)?|google|look up|find)\s+(.+?)(?:\s+(?:on|in)\s+([a-zA-Z0-9\s]+))?$/i);
  if (searchMatch && !text.startsWith("search web for news")) {
    const query = searchMatch[1].trim();
    const platform = (searchMatch[2] || "google").toLowerCase().trim();
    let res;
    let actionName = "open_app";
    if (platform === "google") {
      res = await system.openUrl({ url: `https://www.google.com/search?q=${encodeURIComponent(query)}` });
      actionName = "open_url";
    } else {
      res = await system.openApp({ app: platform, query });
    }
    return {
      action: actionName,
      params: { query, platform },
      summary: `Searched for "${query}" on ${platform}`,
      result: res,
    };
  }

  // 8. Close / Quit Application
  const closeMatch = raw.match(/^(?:close|quit|exit|kill)\s+([a-zA-Z0-9.\s_-]+)$/i);
  if (closeMatch && !text.includes("window")) {
    const targetApp = closeMatch[1].trim();
    const res = await system.closeApp({ app: targetApp });
    return { action: "close_app", params: { app: targetApp }, summary: `Closed ${targetApp}`, result: res };
  }

  // 9. Universal App & Website Launcher
  const openMatch = raw.match(/^(?:open|launch|switch to|start|bring up|go to|visit)\s+([a-zA-Z0-9.:/_\-\s]+?)(?:\s+(?:and|with)\s+(?:search|query|play|order|buy)\s+(.+))?$/i);
  if (openMatch && !text.startsWith("open file")) {
    const rawApp = openMatch[1].trim();
    const query = openMatch[2] ? openMatch[2].trim() : undefined;

    if (/^https?:\/\//i.test(rawApp)) {
      const res = await system.openUrl({ url: rawApp });
      return { action: "open_url", params: { url: rawApp }, summary: `Opened ${rawApp}`, result: res };
    }

    const res = await system.openApp({ app: rawApp, query });
    const prettyApp = rawApp.charAt(0).toUpperCase() + rawApp.slice(1);
    const summary = res?.reused
      ? `Switched to active ${prettyApp}`
      : query
        ? `Opened ${prettyApp} with ${query}`
        : `Opened ${prettyApp}`;
    return {
      action: "open_app",
      params: { app: rawApp, query },
      summary,
      result: res,
    };
  }

  // 10. UI Type, Press Key, Scroll
  const typeMatch = raw.match(/^type\s+(.+)$/i);
  if (typeMatch) {
    const toType = typeMatch[1].trim().replace(/^["']|["']$/g, "");
    const res = await uiControl.typeText({ text: toType });
    return { action: "ui_type", params: { text: toType }, summary: `Typed "${toType.slice(0, 60)}"`, result: res };
  }
  const pressMatch = raw.match(/^press\s+(?:the\s+)?([a-zA-Z0-9+_-]+)(?:\s+key)?$/i);
  if (pressMatch) {
    const key = pressMatch[1].trim().toLowerCase();
    const res = await uiControl.pressKey({ key });
    return { action: "ui_press_key", params: { key }, summary: `Pressed ${key}`, result: res };
  }
  const scrollMatch = raw.match(/^scroll\s+(up|down)(?:\s+(\d+))?$/i);
  if (scrollMatch) {
    const direction = scrollMatch[1].toLowerCase();
    const amount = scrollMatch[2] ? parseInt(scrollMatch[2], 10) : 5;
    const res = await uiControl.scroll({ direction, amount });
    return { action: "ui_scroll", params: { direction, amount }, summary: `Scrolled ${direction}`, result: res };
  }

  // 11. Direct Phone Call / Dialer
  const callMatch = raw.match(/^(?:call|dial)\s+([a-zA-Z0-9+\s]+)$/i);
  if (callMatch && !text.includes("whatsapp") && !text.includes("api")) {
    const calls = require("./deviceControl/handlers/calls");
    const target = callMatch[1].trim();
    const res = await calls.placeCall({ to: target });
    return { action: "place_call", params: { to: target }, summary: `Dialing ${target}`, result: res };
  }

  // 12. Volume & Audio Controls (Fixed: passes `level`, not `percent`!)
  if (text === "mute" || text === "mute volume" || text === "mute sound") {
    const res = await system.setVolume({ mute: true });
    return { action: "set_volume", params: { mute: true }, summary: "Muted volume", result: res };
  }
  if (text === "unmute" || text === "unmute volume" || text === "unmute sound") {
    const res = await system.setVolume({ mute: false });
    return { action: "set_volume", params: { mute: false }, summary: "Unmuted volume", result: res };
  }
  const exactVolMatch = text.match(/^(?:set\s+volume\s+(?:to\s+)?|turn\s+volume\s+(?:to\s+)?|volume\s+(?:to\s+)?)(\d+)%?$/i);
  if (exactVolMatch) {
    const level = Math.min(100, Math.max(0, parseInt(exactVolMatch[1], 10)));
    const res = await system.setVolume({ level });
    return { action: "set_volume", params: { level }, summary: `Set volume to ${level}%`, result: res };
  }
  if (/^(?:volume up|increase volume|raise volume)(?:\s+by\s+(\d+))?$/i.test(text)) {
    const res = await system.setVolume({ level: 75 });
    return { action: "set_volume", params: { level: 75 }, summary: "Increased volume to 75%", result: res };
  }
  if (/^(?:volume down|decrease volume|lower volume)(?:\s+by\s+(\d+))?$/i.test(text)) {
    const res = await system.setVolume({ level: 30 });
    return { action: "set_volume", params: { level: 30 }, summary: "Decreased volume to 30%", result: res };
  }

  // 13. Screen & Screenshots
  if (text.includes("take a screenshot") || text === "take screenshot" || text === "capture screen" || text === "screenshot") {
    const res = await system.takeScreenshot({});
    return { action: "take_screenshot", params: {}, summary: "Captured screenshot", result: res };
  }

  // 14. System Info & Diagnostics
  if (text === "system diagnostic" || text === "system info" || text === "system status" || text === "hardware diagnostic") {
    const res = await system.getSystemInfo({});
    const memMB = res.freeMemMB;
    return {
      action: "get_system_info",
      params: {},
      summary: `System Status: ${res.platform} (${res.arch || process.arch}), Free RAM: ${memMB}MB/${res.totalMemMB}MB, CPUs: ${res.cpuCount ?? res.cpus ?? "?"}, Uptime: ${Math.round(res.uptimeSeconds / 60)}m`,
      result: res,
    };
  }

  // 15. Media Playback Controls
  if (/^(?:play\/pause|play or pause|toggle playback|pause(?: music| playback)?|resume(?: music| playback)?|unpause)$/i.test(text)) {
    const res = await system.mediaControl({ action: "play_pause" });
    return { action: "media_control", params: { action: "play_pause" }, summary: "Toggled media playback", result: res };
  }
  if (/^(?:next track|next song|next music|skip song|skip track)$/i.test(text)) {
    const res = await system.mediaControl({ action: "next" });
    return { action: "media_control", params: { action: "next" }, summary: "Skipped to next track", result: res };
  }
  if (/^(?:previous track|previous song|prev track|prev song)$/i.test(text)) {
    const res = await system.mediaControl({ action: "previous" });
    return { action: "media_control", params: { action: "previous" }, summary: "Returned to previous track", result: res };
  }
  if (/^(?:stop music|stop playback|stop media)$/i.test(text)) {
    const res = await system.mediaControl({ action: "stop" });
    return { action: "media_control", params: { action: "stop" }, summary: "Stopped media playback", result: res };
  }

  // 16. Window & Desktop Management
  if (/^(?:show desktop|minimize all(?: windows)?|hide all windows|go to desktop)$/i.test(text)) {
    const res = await system.windowControl({ action: "show_desktop" });
    return { action: "window_control", params: { action: "show_desktop" }, summary: "Showed desktop", result: res };
  }
  if (/^(?:minimize window|minimize this window|minimize active window)$/i.test(text)) {
    const res = await system.windowControl({ action: "minimize" });
    return { action: "window_control", params: { action: "minimize" }, summary: "Minimized active window", result: res };
  }
  if (/^(?:maximize window|maximize this window|maximize active window)$/i.test(text)) {
    const res = await system.windowControl({ action: "maximize" });
    return { action: "window_control", params: { action: "maximize" }, summary: "Maximized active window", result: res };
  }
  if (/^(?:restore window|restore active window)$/i.test(text)) {
    const res = await system.windowControl({ action: "restore" });
    return { action: "window_control", params: { action: "restore" }, summary: "Restored window", result: res };
  }

  // 17. Workstation Lock
  if (/^(?:lock screen|lock workstation|lock computer|lock pc|lock this pc|lock this machine)$/i.test(text)) {
    const res = await system.lockWorkstation({});
    return { action: "lock_workstation", params: {}, summary: "Locked computer workstation", result: res };
  }

  // 18. Brightness Controls
  const brightMatch = text.match(/^(?:set brightness to|adjust brightness to|change brightness to|brightness)\s+(\d+)%?$/i);
  if (brightMatch) {
    const pct = Math.min(100, Math.max(0, parseInt(brightMatch[1], 10)));
    const res = await system.setBrightness({ percent: pct });
    return { action: "set_brightness", params: { percent: pct }, summary: `Adjusted brightness to ${pct}%`, result: res };
  }
  if (/^(?:dim screen|dim display)$/i.test(text)) {
    const res = await system.setBrightness({ percent: 30 });
    return { action: "set_brightness", params: { percent: 30 }, summary: "Dimmed screen to 30%", result: res };
  }
  if (/^(?:brighten screen|max brightness)$/i.test(text)) {
    const res = await system.setBrightness({ percent: 100 });
    return { action: "set_brightness", params: { percent: 100 }, summary: "Set brightness to 100%", result: res };
  }

  // 19. Clipboard Controls
  if (/^(?:read clipboard|get clipboard|what is in my clipboard|check clipboard|view clipboard)$/i.test(text)) {
    const res = await system.clipboardControl({ action: "read" });
    const preview = res.text ? `"${res.text.slice(0, 100)}"` : "empty";
    return { action: "clipboard_control", params: { action: "read" }, summary: `Read clipboard content: ${preview}`, result: res };
  }
  const copyMatch = raw.match(/^(?:copy|save)\s+(.+?)\s+to clipboard$/i);
  if (copyMatch) {
    const toCopy = copyMatch[1].trim();
    const res = await system.clipboardControl({ action: "copy", text: toCopy });
    return { action: "clipboard_control", params: { action: "copy", text: toCopy }, summary: `Copied to clipboard: "${toCopy.slice(0, 60)}"`, result: res };
  }
  if (/^(?:clear clipboard|empty clipboard)$/i.test(text)) {
    const res = await system.clipboardControl({ action: "clear" });
    return { action: "clipboard_control", params: { action: "clear" }, summary: "Cleared clipboard", result: res };
  }

  // 20. List Running Applications & Windows
  if (/^(?:list running apps|list open windows|list running applications|show running apps|show open windows|what apps are open)$/i.test(text)) {
    const res = await system.listRunningApps({});
    const count = res.windows ? res.windows.length : 0;
    const names = res.windows ? res.windows.slice(0, 5).map((w) => w.name).join(", ") : "";
    return { action: "list_running_apps", params: {}, summary: `Detected ${count} running application windows (${names}${count > 5 ? "..." : ""})`, result: res };
  }

  return null;
}

function splitCompoundClauses(text) {
  const parts = text.split(/\s+(?:and then|and also|then|after that)\s+|\s*;\s*/i);
  if (parts.length > 1) return parts.map((p) => p.trim()).filter(Boolean);

  const verbRegex = /\s+and\s+(?=(?:open|play|search|send|launch|mute|unmute|take|switch|type|pause|resume|skip|stop|minimize|maximize|restore|lock|dim|brighten|copy|read|create|write|make|save|delete|remove|move|rename|close|quit|kill|set|scroll|press|run|check|list|ping)\b)/i;
  const subParts = text.split(verbRegex);
  if (subParts.length > 1) return subParts.map((p) => p.trim()).filter(Boolean);

  return [text];
}

async function tryFastDispatch(rawText) {
  const text = cleanCommandRaw(rawText);
  if (!text) return { matched: false };

  // 1. Try single intent on full text first
  const directMatch = await executeSingleIntent(text);
  if (directMatch) {
    const ok = stepSucceeded(directMatch.result);
    return {
      matched: true,
      ok,
      answer: directMatch.summary.endsWith("sir.") || directMatch.summary.includes("\n```")
        ? directMatch.summary
        : `${directMatch.summary}, sir.`,
      result: directMatch.result,
      steps: [{ action: directMatch.action, params: directMatch.params, result: directMatch.result }],
      category: "device_control",
    };
  }

  // 2. Try compound multi-intent splitting
  const clauses = splitCompoundClauses(text);
  if (clauses.length <= 1) {
    return { matched: false };
  }

  const executedSteps = [];
  const summaries = [];
  const openedApps = new Set();
  let allOk = true;

  for (const clause of clauses) {
    const res = await executeSingleIntent(clause);
    if (res) {
      if (res.action === "open_app" && res.params?.app) {
        const appKey = res.params.app.toLowerCase();
        if (openedApps.has(appKey) && !res.params.query) {
          continue;
        }
        openedApps.add(appKey);
      }
      if (!stepSucceeded(res.result)) allOk = false;
      executedSteps.push({ action: res.action, params: res.params, result: res.result });
      summaries.push(res.summary);
    }
  }

  if (executedSteps.length === 0) {
    return { matched: false };
  }

  const combinedAnswer = summaries.length === 1
    ? `${summaries[0]}, sir.`
    : `${summaries.slice(0, -1).join(", ")} and ${summaries[summaries.length - 1]}, sir.`;

  return {
    matched: true,
    ok: allOk,
    answer: combinedAnswer,
    result: executedSteps[executedSteps.length - 1].result,
    steps: executedSteps,
    category: "device_control",
  };
}

module.exports = { tryFastDispatch };
