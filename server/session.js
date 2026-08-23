const { v4: uuidv4 } = require("uuid");

const SESSION_COOKIE = "sia_session";
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 90; // 90 days

/**
 * Assigns req.sessionId from a cookie, creating one if absent.
 * This is what makes per-user brain isolation actually work end-to-end —
 * without this, every browser would fall through to the same session id
 * and everyone would share one brain again, silently.
 */
function sessionMiddleware(req, res, next) {
  let sessionId = req.cookies?.[SESSION_COOKIE];

  // A cookie can be missing, empty, or (if someone hand-edited it) contain
  // characters brainStore's path-safety check would reject — regenerate
  // rather than let a malformed value reach the filesystem layer.
  const validPattern = /^[a-zA-Z0-9_-]{1,128}$/;
  if (!sessionId || !validPattern.test(sessionId)) {
    sessionId = uuidv4();
    res.cookie(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE_MS,
      secure: process.env.NODE_ENV === "production",
    });
  }

  req.sessionId = sessionId;
  next();
}

module.exports = { sessionMiddleware, SESSION_COOKIE };
