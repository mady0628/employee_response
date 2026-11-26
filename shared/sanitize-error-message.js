function sanitizeErrorMessage(value, maxLength = 1000) {
  return String(value ?? "")
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s,;]+/gi, "$1[REDACTED]")
    .replace(/((?:token|secret|password|api[_-]?key)\s*[:=]\s*)[^\s,;&]+/gi, "$1[REDACTED]")
    .replace(/\b(bot)\d{5,}:[A-Za-z0-9_-]{20,}\b/gi, "$1[REDACTED]")
    .replace(/\b\d{5,}@(c\.us|lid|g\.us)\b/gi, "[REDACTED_ID]")
    .replace(/\b(?:\+?\d[\d .()-]{7,}\d)\b/g, "[REDACTED_PHONE]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]")
    .slice(0, maxLength);
}

module.exports = sanitizeErrorMessage;
