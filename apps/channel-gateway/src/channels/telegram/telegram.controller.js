const telegramService = require("./telegram.service");
const {
  normalizeTelegramMessage,
  nonReplyableServiceField
} = require("./telegram.adapter");
const { publishTelegramEvent } = require("../../publishers/telegram.publisher");
const { normalizeReaction } = require("./telegram-reaction.adapter");
const { publishReaction } = require("../../publishers/reaction.publisher");

async function receiveWebhook(req, res) {
  const update = req.body;
  const bot = req.telegramBot;
  const connectionId = bot?.id || process.env.TELEGRAM_CONNECTION_ID;

  if (!update || !Number.isSafeInteger(update.update_id)) {
    return res.status(200).json({ ok: true });
  }

  try {
    // Nhận sự kiện thả reaction trong group
    if (update.message_reaction) {
      const event = normalizeReaction(
        update,
        connectionId
      );

      if (event) {
        await publishReaction(event);
      }

      return res.status(200).json({ ok: true });
    }

    const message = update.message;

    if (!message) {
      return res.status(200).json({ ok: true });
    }

    if (
      ["group", "supergroup"].includes(message.chat?.type) &&
      nonReplyableServiceField(message)
    ) {
      console.log("Telegram non-replyable service message ignored", {
        serviceType: nonReplyableServiceField(message)
      });
      return res.status(200).json({ ok: true });
    }

    // Private chat: xử lý /start và /verify
    if (message.chat.type === "private") {
      await telegramService.handleTelegramMessage(message, bot?.botToken);
      return res.status(200).json({ ok: true });
    }

    // Group: chuẩn hóa rồi gửi vào RabbitMQ
    if (["group", "supergroup"].includes(message.chat.type)) {
      const event = normalizeTelegramMessage(
        update,
        connectionId
      );

      if (event) {
        await publishTelegramEvent(event);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error(
      "Telegram webhook failed:",
      error.message
    );

    return res.status(503).json({ ok: false });
  }
}

module.exports = { receiveWebhook };
