const {
  client,
  startWhatsApp,
  isMonitoringReady,
  getMonitoringStartedAt
} = require("./whatsapp.client");

// Danh sách group được phép giám sát.
// Để trống thì chỉ hiển thị ID group,
// chưa in nội dung tin nhắn.
const allowedGroups = new Set(
  (process.env.WA_GROUP_IDS || "")
    .split(",")
    .map(id => id.trim())
    .filter(Boolean)
);

const seenMessageIds = new Set();

client.on("message_create", async message => {
  try {
    if (!isMonitoringReady()) return;

    const chat = await message.getChat();

    // Chỉ lấy tin nhắn group.
    if (!chat.isGroup) return;

    const groupId = chat.id._serialized;

    if (!allowedGroups.has(groupId)) {
      console.log("Group discovered:", {
        groupId,
        groupName: chat.name
      });
      return;
    }

    const messageId = message.id._serialized;

    // Chống xử lý trùng trong phiên chạy hiện tại.
    if (seenMessageIds.has(messageId)) return;

    // WhatsApp timestamp thường là Unix seconds.
    const sentAt = new Date(Number(message.timestamp) * 1000);
    if (!Number.isFinite(sentAt.getTime())) {
      return;
    }

    const startedAt = getMonitoringStartedAt();
    if (!startedAt || sentAt < startedAt) {
      return;
    }

    // Trong group, author là người gửi.
    // from là ID của group.
    const senderId =
      message.author ||
      (message.fromMe ? client.info?.wid?._serialized : null);
    if (!senderId) return;

    if (seenMessageIds.size >= 10000) {
      seenMessageIds.clear();
    }
    seenMessageIds.add(messageId);

    let replyToMessageId = null;
    if (message.hasQuotedMsg) {
      try {
        const quoted = await message.getQuotedMessage();
        replyToMessageId = quoted?.id?._serialized || null;
      } catch (error) {
        console.error(
          "Cannot resolve quoted message:",
          error.message
        );
      }
    }

    const normalizedEvent = {
      eventId: `whatsapp:${messageId}`,
      eventType: "channel.message.received",
      schemaVersion: 1,
      platform: "WHATSAPP",
      conversation: {
        externalId: groupId,
        title: chat.name,
        type: "GROUP"
      },
      sender: {
        externalId: senderId,
        isBot: false
      },
      message: {
        externalId: messageId,
        replyToExternalMessageId: replyToMessageId,
        type: String(message.type).toUpperCase(),
        content: message.body || null,
        sentAt: sentAt.toISOString()
      }
    };

    console.log(
      "NEW WHATSAPP MESSAGE:",
      JSON.stringify(normalizedEvent, null, 2)
    );
  } catch (error) {
    console.error(
      "WhatsApp message processing failed:",
      error.message
    );
  }
});

startWhatsApp().catch(error => {
  console.error("WhatsApp initialization failed:", error);
  process.exitCode = 1;
});
