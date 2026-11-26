const { telegramConfig } = require("../../config/telegram.config");

async function callTelegramApi(method, payload, botToken = telegramConfig.botToken) {
  if (!botToken) throw new Error("Telegram bot token is not configured");
  const url = `${telegramConfig.apiBaseUrl}/bot${botToken}/${method}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000)
  });

  const data = await response.json();

  if (!response.ok || data.ok !== true) {
    // Không log URL vì URL chứa Bot Token.
    throw new Error(
      `Telegram ${method} failed: ${data.error_code || response.status}` +
        (data.description ? ` - ${data.description}` : "")
    );
  }

  return data.result;
}

async function sendMessage(chatId, text, botToken = telegramConfig.botToken) {
  return callTelegramApi("sendMessage", {
    chat_id: chatId,
    text
  }, botToken);
}

async function getBotInfo(botToken = telegramConfig.botToken) {
  return callTelegramApi("getMe", {}, botToken);
}

async function getWebhookInfo(botToken = telegramConfig.botToken) {
  return callTelegramApi("getWebhookInfo", {}, botToken);
}

async function getWebhookUrl(connectionId) {
  let configuredUrl = telegramConfig.webhookUrl;
  if (!configuredUrl && telegramConfig.botToken) {
    configuredUrl = (await getWebhookInfo()).url;
  }
  if (!configuredUrl) {
    throw new Error("TELEGRAM_WEBHOOK_URL is not configured and no existing Telegram webhook URL is available");
  }

  const url = new URL(configuredUrl);
  let path = url.pathname.replace(/\/+$/, "");
  path = path.replace(/\/webhooks\/telegram\/\d+$/, "/webhooks/telegram");
  if (!path.endsWith("/webhooks/telegram")) {
    throw new Error("Telegram webhook base URL must end with /webhooks/telegram");
  }
  url.pathname = `${path}/${encodeURIComponent(connectionId)}`;
  return url.toString();
}

async function configureWebhookForBot({ botToken, webhookSecret, connectionId }) {
  const webhookUrl = await getWebhookUrl(connectionId);
  await callTelegramApi("setWebhook", {
    url: webhookUrl,
    secret_token: webhookSecret,
    allowed_updates: ["message", "message_reaction"]
  }, botToken);

  const verified = await getWebhookInfo(botToken);
  const updates = verified.allowed_updates || [];
  if (verified.url !== webhookUrl || !updates.includes("message") || !updates.includes("message_reaction")) {
    throw new Error("Telegram webhook setup could not be verified");
  }
  return verified;
}

async function setupWebhook() {
  const current = await getWebhookInfo();
  const webhookUrl = telegramConfig.webhookUrl || current.url;

  if (!webhookUrl) {
    throw new Error(
      "Telegram webhook URL is not configured; set TELEGRAM_WEBHOOK_URL"
    );
  }

  await callTelegramApi("setWebhook", {
    url: webhookUrl,
    secret_token: telegramConfig.webhookSecret,
    allowed_updates: ["message", "message_reaction"]
  });

  const verified = await getWebhookInfo();
  const updates = verified.allowed_updates || [];

  if (
    verified.url !== webhookUrl ||
    !updates.includes("message") ||
    !updates.includes("message_reaction")
  ) {
    throw new Error("Telegram webhook setup could not be verified");
  }

  console.log("Telegram webhook configured:", {
    url: verified.url,
    allowedUpdates: updates
  });
  return verified;
}

async function getChatMember(chatId, userId, botToken = telegramConfig.botToken) {
  try {
    return await callTelegramApi("getChatMember", {
      chat_id: chatId,
      user_id: userId
    }, botToken);
  } catch (error) {
    error.message = `${error.message} (chat_id=${chatId}, user_id=${userId})`;
    throw error;
  }
}

module.exports = {
  sendMessage,
  getBotInfo,
  getWebhookInfo,
  configureWebhookForBot,
  getWebhookUrl,
  getChatMember,
  setupWebhook
};
