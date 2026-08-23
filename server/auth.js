const crypto = require("crypto");

const AUTH_COOKIE = "sia_auth";
const AUTH_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

/**
 * Whether auth is actually enforced. If SIA_PASSWORD isn't set, Sia runs
 * open (fine for local-only dev on your own machine) but logs a loud
 * warning on boot — see index.js. The moment you deploy this somewhere
 * reachable by anyone else, set SIA_PASSWORD.
 */
function authEnabled() {
  return Boolean(process.env.SIA_PASSWORD);
}

function getSecret() {
  // Falls back to a derived-from-password secret if SESSION_SECRET isn't
  // set, so auth still works with zero extra config — but a dedicated
  // SESSION_SECRET is stronger since it's independent of the password.
  return process.env.SESSION_SECRET || `sia-fallback-${process.env.SIA_PASSWORD || ""}`;
}

function sign(value) {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("hex");
}

/**
 * Constant-time compare — avoids leaking password/token correctness via
 * response-time differences (a real, if minor, timing side-channel).
 */
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function makeToken() {
  const issuedAt = Date.now().toString();
  const signature = sign(issuedAt);
  return `${issuedAt}.${signature}`;
}

function verifyToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return false;
  const [issuedAt, signature] = token.split(".");
  if (!issuedAt || !signature) return false;

  const expected = sign(issuedAt);
  if (!safeEqual(signature, expected)) return false;

  const age = Date.now() - Number(issuedAt);
  return age >= 0 && age <= AUTH_MAX_AGE_MS;
}

function checkPassword(candidate) {
  if (!authEnabled()) return true;
  if (typeof candidate !== "string" || candidate.length === 0) return false;
  return safeEqual(candidate, process.env.SIA_PASSWORD);
}

function issueAuthCookie(res) {
  res.cookie(AUTH_COOKIE, makeToken(), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: AUTH_MAX_AGE_MS,
    secure: process.env.NODE_ENV === "production",
  });
}

function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE);
}

/**
 * Middleware for API routes. Skips enforcement entirely if SIA_PASSWORD
 * isn't set (local dev). Otherwise requires a valid signed cookie.
 */
function requireAuth(req, res, next) {
  if (!authEnabled()) return next();

  const token = req.cookies?.[AUTH_COOKIE];
  if (verifyToken(token)) return next();

  return res.status(401).json({ error: "Not authenticated", authRequired: true });
}

module.exports = {
  AUTH_COOKIE,
  authEnabled,
  checkPassword,
  issueAuthCookie,
  clearAuthCookie,
  requireAuth,
};
