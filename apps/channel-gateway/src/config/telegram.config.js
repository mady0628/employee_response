const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
require("dotenv").config();

const telegramConfig = {
  botToken: process.env.TELEGRAM_BOT_TOKEN,
  webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
  webhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
  connectionId: process.env.TELEGRAM_CONNECTION_ID,
  apiBaseUrl: "https://api.telegram.org"
};

function validateTelegramConfig() {
  if (!telegramConfig.botToken) {
    return false;
  }

  const required = [
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_WEBHOOK_SECRET",
    "TELEGRAM_CONNECTION_ID",
    "IDENTITY_SERVICE_URL",
    "IDENTITY_INTERNAL_API_KEY"
  ];

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing environment variable: ${key}`);
    }
  }

  if (
    !/^[A-Za-z0-9_-]{1,256}$/.test(
      telegramConfig.webhookSecret
    )
  ) {
    throw new Error("Invalid Telegram webhook secret format");
  }

  if (
    !/^[1-9]\d*$/.test(
      telegramConfig.connectionId
    )
  ) {
    throw new Error("Invalid Telegram connection ID");
  }

  return true;
}

module.exports = { telegramConfig, validateTelegramConfig };
