const crypto = require("node:crypto");
const configClient = require("../../clients/config.client");

async function verifyTelegramBotWebhook(req, res, next) {
  try {
    const bot = await configClient.getTelegramBotRuntime(req.params.connectionId);
    const received = req.get("X-Telegram-Bot-Api-Secret-Token") || "";
    const expected = String(bot.webhookSecret || "");
    const receivedHash = crypto.createHash("sha256").update(received).digest();
    const expectedHash = crypto.createHash("sha256").update(expected).digest();
    if (!received || !expected || !crypto.timingSafeEqual(receivedHash, expectedHash)) {
      return res.status(401).json({ ok: false });
    }
    req.telegramBot = bot;
    return next();
  } catch (error) {
    return res.status(error.status === 404 ? 404 : 503).json({ ok: false });
  }
}

module.exports = verifyTelegramBotWebhook;
