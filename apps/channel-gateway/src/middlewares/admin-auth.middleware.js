const crypto = require("crypto");

const COOKIE_NAME = "admin_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;

function sessionSecret() {
  return process.env.ADMIN_DASHBOARD_SESSION_SECRET || "";
}

function configuredUsername() {
  return process.env.ADMIN_DASHBOARD_USERNAME || "";
}

function sign(value) {
  return crypto.createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function readSession(req) {
  if (!sessionSecret() || !configuredUsername()) return null;
  const cookies = String(req.headers.cookie || "").split(";");
  const entry = cookies.map(value => value.trim()).find(value => value.startsWith(`${COOKIE_NAME}=`));
  if (!entry) return null;
  const token = entry.slice(COOKIE_NAME.length + 1);
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;
  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!safeEqual(signature, sign(payload))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (session.exp <= Math.floor(Date.now() / 1000)) return null;
    if (!safeEqual(session.username, configuredUsername())) return null;
    return { id: 1, role: "ADMIN", username: session.username };
  } catch {
    return null;
  }
}

function createSessionToken(username) {
  const payload = Buffer.from(JSON.stringify({
    username,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=${token}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}${secure}`);
}

function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=0${secure}`);
}

function requireAuthenticatedAdmin(req, res, next) {
  const admin = readSession(req);
  if (!admin) {
    return res.status(401).json({ success: false, message: "Vui lòng đăng nhập để tiếp tục." });
  }
  req.admin = admin;
  return next();
}

function login(req, res) {
  const username = configuredUsername();
  const password = process.env.ADMIN_DASHBOARD_PASSWORD || "";
  if (!username || !password || !sessionSecret()) {
    return res.status(503).json({ success: false, message: "Chưa cấu hình tài khoản dashboard." });
  }
  const providedUsername = typeof req.body?.username === "string" ? req.body.username : "";
  const providedPassword = typeof req.body?.password === "string" ? req.body.password : "";
  if (!safeEqual(providedUsername, username) || !safeEqual(providedPassword, password)) {
    return res.status(401).json({ success: false, message: "Tên đăng nhập hoặc mật khẩu không đúng." });
  }
  setSessionCookie(res, createSessionToken(username));
  return res.json({ success: true, data: { username, role: "ADMIN" } });
}

function getSession(req, res) {
  return res.json({ success: true, data: req.admin });
}

function logout(req, res) {
  clearSessionCookie(res);
  return res.json({ success: true });
}

module.exports = {
  requireAuthenticatedAdmin,
  login,
  getSession,
  logout,
  SESSION_TTL_SECONDS
};
