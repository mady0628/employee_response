function parseContent(rawContent) {
  if (!rawContent) return null;

  try {
    const content =
      typeof rawContent === "string"
        ? JSON.parse(rawContent)
        : rawContent;

    if (typeof content.text === "string") {
      return content.text;
    }

    // Các dạng ảnh, file, card...
    // Có thể bổ sung parser riêng sau.
    return null;
  } catch {
    return null;
  }
}

function normalizeLarkMessage(data, connectionId) {
  const { sender, message } = data;

  if (!message || !sender) {
    throw new Error("Invalid Lark message event");
  }

  // Bước này chỉ xử lý tin nhắn group.
  // Private chat xác thực nhân viên sẽ làm sau.
  if (message.chat_type !== "group") {
    return null;
  }

  const senderId = sender.sender_id?.open_id;

  if (
    !senderId ||
    !message.chat_id ||
    !message.message_id
  ) {
    throw new Error("Missing Lark message identifiers");
  }

  const sentAtMillis = Number(message.create_time);

  if (!Number.isFinite(sentAtMillis) || sentAtMillis <= 0) {
    throw new Error("Invalid Lark message timestamp");
  }

  return {
    eventId: `lark:${connectionId}:${message.message_id}`,
    eventType: "channel.message.received",
    schemaVersion: 1,

    platform: "LARK",
    connectionId: String(connectionId),

    conversation: {
      externalId: String(message.chat_id),
      title: null,
      type: "GROUP"
    },

    sender: {
      externalId: String(senderId),
      displayName: null,
      username: null,
      isBot: sender.sender_type !== "user",
      isMonitor: false
    },

    message: {
      externalId: String(message.message_id),
      replyToExternalMessageId: message.parent_id
        ? String(message.parent_id)
        : null,
      type: String(message.message_type || "unknown").toUpperCase(),
      content: parseContent(message.content),
      sentAt: new Date(sentAtMillis).toISOString()
    }
  };
}

module.exports = { normalizeLarkMessage };
