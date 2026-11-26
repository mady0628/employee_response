async function normalizeWhatsAppMessage(client, message, connectionId) {
  const chat = await message.getChat();
  if (!chat.isGroup) {
    return null;
  }
  const groupId = chat.id._serialized;
  const serializeId = value =>
    typeof value === "string" ? value : value?._serialized || value?.$1 || null;
  const senderCandidates = [
    ["message.author", serializeId(message.author)],
    ["message._data.author", serializeId(message._data?.author)],
    ["message._data.participant", serializeId(message._data?.participant)],
    [
      "monitor account",
      message.fromMe ? serializeId(client.info?.wid) : null
    ]
  ];
  const senderId = senderCandidates.find(([, id]) => id)?.[1] || null;

  if (!senderId) {
    // Tin nhắn hệ thống của WhatsApp (thông báo bảo mật, thêm thành viên...), bỏ qua an toàn
    console.warn("WhatsApp message ignored: sender ID missing");
    return null;
  }

  const readContactName = contact => {
    for (const candidate of [
      contact?.pushname,
      contact?.name,
      contact?.shortName
    ]) {
      const value = typeof candidate === "string"
        ? candidate.trim()
        : "";

      if (
        value &&
        value !== senderId &&
        !/@(?:lid|c\.us)$/.test(value)
      ) {
        return value;
      }
    }

    return null;
  };

  let senderDisplayName = null;
  try {
    const contact = await message.getContact();
    senderDisplayName = readContactName(contact);
  } catch (error) {
    // Tên contact là thông tin bổ sung; không bỏ mất message nếu lookup lỗi.
    console.warn("WhatsApp contact lookup failed", { error: error.message });
  }

  // Group messages can expose only a LID. Resolve it to the phone JID and
  // query that contact as a second attempt to obtain the WhatsApp profile name.
  if (!senderDisplayName && senderId.endsWith("@lid")) {
    try {
      const [mapping] = await client.getContactLidAndPhone([senderId]);
      if (mapping?.pn && mapping.pn.endsWith("@c.us")) {
        const phoneContact = await client.getContactById(mapping.pn);
        senderDisplayName = readContactName(phoneContact);
      } else {
        console.warn("WhatsApp LID did not resolve to a phone ID");
      }
    } catch (error) {
      // Identity mapping is best-effort; continue to save the message.
      console.warn("WhatsApp identity lookup failed", { error: error.message });
    }
  }

  const messageId = message.id?._serialized;
  if (!messageId) {
    throw new Error("WhatsApp message ID missing");
  }
  const timestamp = Number(message.timestamp);
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0) {
    throw new Error("Invalid WhatsApp timestamp");
  }
  let replyToExternalMessageId = null;
  if (message.hasQuotedMsg) {
    try {
      const quoted = await message.getQuotedMessage();
      replyToExternalMessageId = quoted?.id?._serialized || null;
    } catch (error) {
      console.error(
        "Cannot resolve quoted message:",
        error.message
      );
    }
  }
  return {
    eventId: `whatsapp:${connectionId}:${messageId}`,
    eventType: "channel.message.received",
    schemaVersion: 1,
    platform: "WHATSAPP",
    connectionId: String(connectionId),
    conversation: {
      externalId: groupId,
      title: chat.name || null,
      type: "GROUP"
    },
    sender: {
      externalId: senderId,
      displayName: senderDisplayName,
      isBot: false,
      isMonitor: Boolean(message.fromMe),
      username: null
    },
    message: {
      externalId: messageId,
      replyToExternalMessageId,
      type: String(message.type || "unknown").toUpperCase(),
      content: message.body || null,
      sentAt: new Date(timestamp * 1000).toISOString()
    }
  };
}

module.exports = { normalizeWhatsAppMessage };
