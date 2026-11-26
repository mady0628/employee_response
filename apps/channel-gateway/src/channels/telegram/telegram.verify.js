const crypto = require("node:crypto");

function verifyTelegramWebhook(req, res, next) {
  const received = req.get(
    "X-Telegram-Bot-Api-Secret-Token"
  );
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!received || !expected) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized"
    });
  }

  const receivedHash = crypto
    .createHash("sha256")
    .update(received)
    .digest();

  const expectedHash = crypto
    .createHash("sha256")
    .update(expected)
    .digest();

  if (!crypto.timingSafeEqual(receivedHash, expectedHash)) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized"
    });
  }

  next();
}

module.exports = verifyTelegramWebhook;
