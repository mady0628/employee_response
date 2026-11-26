const telegramClient = require("../channels/telegram/telegram.client");
const configClient = require("../clients/config.client");
const sanitizeErrorMessage = require("../../../../shared/sanitize-error-message");

async function list(req, res, next) {
  try {
    return res.json({ success: true, data: await configClient.getTelegramBots() });
  } catch (error) { return next(error); }
}

async function add(req, res, next) {
  let savedBot;
  try {
    const botToken = typeof req.body?.botToken === "string" ? req.body.botToken.trim() : "";
    if (!botToken) return res.status(400).json({ success: false, message: "Nhập Telegram bot token" });
    const botInfo = await telegramClient.getBotInfo(botToken);
    savedBot = await configClient.createTelegramBot({
      displayName: req.body?.displayName,
      botId: String(botInfo.id),
      botUsername: botInfo.username || null,
      botToken
    });

    try {
      const runtime = await configClient.getTelegramBotRuntime(savedBot.id);
      await telegramClient.configureWebhookForBot({
        botToken: runtime.botToken,
        webhookSecret: runtime.webhookSecret,
        connectionId: runtime.id
      });
      savedBot = await configClient.updateTelegramBotStatus(savedBot.id, "CONNECTED");
    } catch (error) {
      savedBot = await configClient.updateTelegramBotStatus(
        savedBot.id,
        "ERROR",
        sanitizeErrorMessage(error.message, 500)
      );
    }

    return res.status(201).json({ success: true, data: savedBot });
  } catch (error) {
    return next(error);
  }
}

async function configureWebhook(req, res, next) {
  const id = req.params.id;
  try {
    const runtime = await configClient.getTelegramBotRuntime(id);
    await telegramClient.configureWebhookForBot({
      botToken: runtime.botToken,
      webhookSecret: runtime.webhookSecret,
      connectionId: runtime.id
    });
    const bot = await configClient.updateTelegramBotStatus(id, "CONNECTED");
    return res.json({ success: true, data: bot });
  } catch (error) {
    try {
      await configClient.updateTelegramBotStatus(id, "ERROR", sanitizeErrorMessage(error.message, 500));
    } catch {}
    return next(error);
  }
}

async function check(req, res, next) {
  const id = req.params.id;
  try {
    const runtime = await configClient.getTelegramBotRuntime(id);
    const [botInfo, webhook] = await Promise.all([
      telegramClient.getBotInfo(runtime.botToken),
      telegramClient.getWebhookInfo(runtime.botToken)
    ]);
    const expectedUrl = await telegramClient.getWebhookUrl(runtime.id);
    const updates = webhook.allowed_updates || [];
    const ready = String(botInfo.id) === String(runtime.botId) &&
      webhook.url === expectedUrl && updates.includes("message") && updates.includes("message_reaction");
    const bot = await configClient.updateTelegramBotStatus(
      id,
      ready ? "CONNECTED" : "PENDING",
      ready ? null : "Webhook Telegram chưa được cấu hình đầy đủ"
    );
    return res.json({ success: true, data: bot, webhook: {
      configured: ready,
      pendingUpdateCount: Number(webhook.pending_update_count || 0),
      lastErrorMessage: webhook.last_error_message || null
    } });
  } catch (error) {
    try {
      await configClient.updateTelegramBotStatus(id, "ERROR", sanitizeErrorMessage(error.message, 500));
    } catch {}
    return next(error);
  }
}

module.exports = { list, add, configureWebhook, check };
