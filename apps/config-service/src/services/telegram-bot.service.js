const repository = require("../repositories/telegram-bot.repository");
const { createWebhookSecret } = require("../../../../shared/telegram-credentials");

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function validateId(value) {
  const id = String(value ?? "");
  if (!/^[1-9]\d*$/.test(id)) fail(400, "Invalid Telegram connection ID");
  return id;
}

async function list() {
  return repository.findAll();
}

async function create({ displayName, botId, botUsername, botToken }) {
  const name = typeof displayName === "string" ? displayName.trim() : "";
  const token = typeof botToken === "string" ? botToken.trim() : "";
  if (name.length < 3 || name.length > 150) fail(400, "Tên bot phải có từ 3 đến 150 ký tự");
  if (!/^[1-9]\d{4,14}$/.test(String(botId || ""))) fail(400, "Telegram bot không hợp lệ");
  if (!/^\d{5,}:[A-Za-z0-9_-]{20,}$/.test(token)) fail(400, "Telegram bot token không hợp lệ");
  if (botUsername != null && (typeof botUsername !== "string" || botUsername.length > 255)) {
    fail(400, "Telegram bot username không hợp lệ");
  }
  return repository.create({
    displayName: name,
    botId: String(botId),
    botUsername: botUsername || null,
    botToken: token,
    webhookSecret: createWebhookSecret()
  });
}

async function getRuntimeCredentials(id) {
  const result = await repository.getRuntimeCredentials(validateId(id));
  if (!result) fail(404, "Telegram bot not found");
  return result;
}

async function setStatus(id, status, errorMessage) {
  const connectionId = validateId(id);
  if (!["PENDING", "CONNECTED", "ERROR"].includes(status)) fail(400, "Invalid Telegram connection status");
  const safeError = typeof errorMessage === "string" ? errorMessage.slice(0, 500) : null;
  const result = await repository.updateStatus(connectionId, status, safeError);
  if (!result) fail(404, "Telegram bot not found");
  return result;
}

module.exports = { list, create, getRuntimeCredentials, setStatus };
