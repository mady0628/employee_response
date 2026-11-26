const telegramClient = require(
  "../channels/telegram/telegram.client"
);
const configClient = require("../clients/config.client");

async function getTelegramCredentials(req) {
  const received = String(req.body?.connectionId ?? "");
  const expected = String(process.env.TELEGRAM_CONNECTION_ID);

  if (process.env.TELEGRAM_BOT_TOKEN && received === expected) {
    return { botToken: process.env.TELEGRAM_BOT_TOKEN };
  }

  return configClient.getTelegramBotRuntime(received);
}

async function getChatMember(req, res, next) {
  try {
    const bot = await getTelegramCredentials(req);

    const { chatId, userId } = req.body;

    if (
      !/^-?\d+$/.test(String(chatId ?? "")) ||
      !/^[1-9]\d*$/.test(String(userId ?? ""))
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid chatId or userId"
      });
    }

    const member = await telegramClient.getChatMember(
      String(chatId),
      String(userId),
      bot.botToken
    );

    return res.json({
      success: true,
      data: {
        status: member.status,
        isMember: member.is_member ?? null
      }
    });

  } catch (error) {
    next(error);
  }
}

async function sendMessage(req, res, next) {
  try {
    const bot = await getTelegramCredentials(req);

    const { chatId, text } = req.body;

    if (
      !/^-?\d+$/.test(String(chatId ?? "")) ||
      typeof text !== "string" ||
      !text.trim() ||
      text.length > 4000
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid message payload"
      });
    }

    const result = await telegramClient.sendMessage(
      String(chatId),
      text,
      bot.botToken
    );

    return res.json({
      success: true,
      data: {
        messageId: result.message_id
      }
    });

  } catch (error) {
    next(error);
  }
}

module.exports = {
  getChatMember,
  sendMessage
};
