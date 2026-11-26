const crypto = require("node:crypto");

function internalAuth(req, res, next) {
  const expected = process.env.GATEWAY_INTERNAL_API_KEY;
  const received = req.get("x-internal-api-key");
  if (!expected) return res.status(503).json({ success: false, message: "Internal authentication is not configured" });
  if (!received) return res.status(401).json({ success: false, message: "Unauthorized" });
  const expectedHash = crypto.createHash("sha256").update(expected).digest();
  const receivedHash = crypto.createHash("sha256").update(received).digest();
  if (!crypto.timingSafeEqual(expectedHash, receivedHash)) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  return next();
}

module.exports = internalAuth;
