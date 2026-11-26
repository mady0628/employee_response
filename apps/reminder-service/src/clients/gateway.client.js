const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
require("dotenv").config();

async function callGateway(pathStr, body) {
  const response = await fetch(
    `${process.env.GATEWAY_SERVICE_URL}/internal/telegram/${pathStr}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-api-key": process.env.GATEWAY_INTERNAL_API_KEY
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000)
    }
  );

  const result = await response.json();

  if (!response.ok || !result.success) {
    const error = new Error(
      result.message || `Gateway ${pathStr} returned ${response.status}`
    );
    error.status = response.status;
    throw error;
  }

  return result.data;
}

async function getChatMember(connectionId, chatId, userId) {
  return callGateway("chat-member", {
    connectionId: String(connectionId),
    chatId: String(chatId),
    userId: String(userId)
  });
}

async function sendMessage(connectionId, chatId, text) {
  return callGateway("send-message", {
    connectionId: String(connectionId),
    chatId: String(chatId),
    text
  });
}

module.exports = { getChatMember, sendMessage };
