async function callLarkGateway(path, payload) {
  const response = await fetch(
    `${process.env.GATEWAY_SERVICE_URL}/internal/lark/${path}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-api-key":
          process.env.GATEWAY_INTERNAL_API_KEY
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000)
    }
  );

  if (!response.ok) {
    throw new Error(
      `Lark Gateway returned HTTP ${response.status}`
    );
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(
      "Lark Gateway request failed"
    );
  }

  return result.data;
}

async function getGroupMembers(
  connectionId,
  chatId
) {
  return callLarkGateway("group-members", {
    connectionId: String(connectionId),
    chatId: String(chatId)
  });
}

async function sendPrivateMessage(
  connectionId,
  openId,
  text
) {
  return callLarkGateway("send-message", {
    connectionId: String(connectionId),
    openId: String(openId),
    text
  });
}

module.exports = {
  getGroupMembers,
  sendPrivateMessage
};
