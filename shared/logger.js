const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const logDir = path.resolve(process.env.LOG_DIR || path.join(process.cwd(), "logs"));
const maxBytesSetting = Number(process.env.LOG_MAX_FILE_BYTES || 10 * 1024 * 1024);
const retentionSetting = Number(process.env.LOG_RETENTION_DAYS || 14);
const maxBytes = Number.isSafeInteger(maxBytesSetting) && maxBytesSetting >= 1024 * 1024
  ? maxBytesSetting
  : 10 * 1024 * 1024;
const retentionDays = Number.isSafeInteger(retentionSetting) && retentionSetting >= 1
  ? retentionSetting
  : 14;
const sensitiveKey = /token|secret|password|authorization|api.?key|content|body|message|email|phone|sender|recipient|user.?id|chat.?id|group.?id|external.?id|display.?name|username|open.?id|platform.?id|qr/i;
let activeFile;
let modeAppliedFile;
let activeDate;
let part = 0;
let lastCleanupDate;

function sanitize(value, key = "") {
  if (/^event.?id$/i.test(key) && typeof value === "string") {
    return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
  }
  if (sensitiveKey.test(key)) return "[REDACTED]";
  if (value instanceof Error) {
    return { name: value.name, message: sanitize(value.message), code: value.code };
  }
  if (Array.isArray(value)) return value.map(item => sanitize(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sanitize(v, k)]));
  }
  if (typeof value === "string") {
    return value
      .replace(/\b\d{5,}@(c\.us|lid|g\.us)\b/gi, "[REDACTED_ID]")
      .replace(/(bot)\d{5,}:[A-Za-z0-9_-]{20,}/gi, "$1[REDACTED]")
      .replace(/\b(?:\+?\d[\d .()-]{7,}\d)\b/g, "[REDACTED_PHONE]")
      .slice(0, 2000);
  }
  return value;
}

function ensureFile() {
  const date = new Date().toISOString().slice(0, 10);
  if (date !== activeDate) { activeDate = date; part = 0; activeFile = null; }
  fs.mkdirSync(logDir, { recursive: true, mode: 0o700 });
  while (true) {
    const candidate = path.join(logDir, `${date}${part ? `.${part}` : ""}.jsonl`);
    try {
      if (fs.statSync(candidate).size >= maxBytes) {
        if (part >= 4) return null;
        part += 1;
        continue;
      }
    }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    activeFile = candidate;
    break;
  }
  if (lastCleanupDate !== date) {
    lastCleanupDate = date;
    const cutoff = Date.now() - retentionDays * 86400000;
    for (const name of fs.readdirSync(logDir)) {
      if (!/^\d{4}-\d{2}-\d{2}(?:\.\d+)?\.jsonl$/.test(name)) continue;
      const file = path.join(logDir, name);
      try { if (fs.statSync(file).mtimeMs < cutoff) fs.unlinkSync(file); } catch { /* best effort cleanup */ }
    }
  }
  try { fs.chmodSync(logDir, 0o700); } catch { /* best effort permissions */ }
  if (activeFile && modeAppliedFile !== activeFile) {
    try { fs.chmodSync(activeFile, 0o600); } catch { /* created on first append */ }
    modeAppliedFile = activeFile;
  }
  return activeFile;
}

function write(level, args) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: process.env.SERVICE_NAME || path.basename(logDir),
    message: args.map(arg => typeof arg === "string" ? sanitize(arg) : sanitize(arg))
  };
  const line = `${JSON.stringify(entry)}\n`;
  try {
    const file = ensureFile();
    if (file) fs.appendFileSync(file, line, { mode: 0o600 });
  } catch (error) {
    process.stderr.write(`log-file-write-failed: ${error.message}\n`);
  }
  (level === "error" ? process.stderr : process.stdout).write(line);
}

for (const level of ["log", "info", "warn", "error", "debug"]) {
  console[level] = (...args) => write(level === "log" ? "info" : level, args);
}

module.exports = { sanitize };
