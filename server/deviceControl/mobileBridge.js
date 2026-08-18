const { WebSocketServer } = require("ws");
const { randomUUID } = require("crypto");

/**
 * MOBILE BRIDGE
 * -------------
 * The Android companion app (see /android-companion) opens a WebSocket
 * connection here and authenticates with ANDROID_PAIR_TOKEN. Once
 * connected, the server can send it commands (tap/swipe/type/read-screen/
 * open-app) and get results back — same shape as the desktop handlers,
 * just executed on the phone via its Accessibility Service instead of on
 * this machine.
 *
 * One device per session is expected for a personal setup. If you pair
 * more than one phone, the newest connection for a given sessionId wins.
 */

const devicesBySession = new Map(); // sessionId -> ws
const pending = new Map(); // commandId -> { resolve, reject, timeout }

const COMMAND_TIMEOUT_MS = 15_000;

function attach(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname !== "/ws/mobile") return; // not ours, let other handlers deal with it

    const token = url.searchParams.get("token");
    const sessionId = url.searchParams.get("sessionId");
    const expected = process.env.ANDROID_PAIR_TOKEN;

    if (!expected || token !== expected || !sessionId) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      devicesBySession.set(sessionId, ws);
      console.log(`[mobileBridge] Android device connected for session ${sessionId}`);

      ws.on("message", (raw) => {
        let msg;
        try {
          msg = JSON.parse(raw.toString());
        } catch {
          return;
        }
        const waiter = pending.get(msg.id);
        if (waiter) {
          clearTimeout(waiter.timeout);
          pending.delete(msg.id);
          if (msg.ok) waiter.resolve(msg.result);
          else waiter.reject(new Error(msg.error || "Device reported an error"));
        }
      });

      ws.on("close", () => {
        if (devicesBySession.get(sessionId) === ws) devicesBySession.delete(sessionId);
        console.log(`[mobileBridge] Android device disconnected for session ${sessionId}`);
      });
    });
  });

  return wss;
}

function isDeviceConnected(sessionId) {
  const ws = devicesBySession.get(sessionId);
  return Boolean(ws && ws.readyState === ws.OPEN);
}

function sendCommand(sessionId, type, params = {}) {
  const ws = devicesBySession.get(sessionId);
  if (!ws || ws.readyState !== ws.OPEN) {
    return Promise.reject(
      new Error("No Android companion app connected for this session. Open the Sia Companion app on your phone first.")
    );
  }

  const id = randomUUID();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Phone did not respond to "${type}" within ${COMMAND_TIMEOUT_MS / 1000}s`));
    }, COMMAND_TIMEOUT_MS);

    pending.set(id, { resolve, reject, timeout });
    ws.send(JSON.stringify({ id, type, params }));
  });
}

module.exports = { attach, sendCommand, isDeviceConnected };
