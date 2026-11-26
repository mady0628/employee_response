const NON_REPLYABLE_SERVICE_FIELDS = [
  "new_chat_members",
  "left_chat_member",
  "new_chat_title",
  "new_chat_photo",
  "delete_chat_photo",
  "group_chat_created",
  "supergroup_chat_created",
  "channel_chat_created",
  "migrate_to_chat_id",
  "migrate_from_chat_id",
  "pinned_message",
  "proximity_alert_triggered",
  "forum_topic_created",
  "forum_topic_edited",
  "forum_topic_closed",
  "forum_topic_reopened",
  "general_forum_topic_hidden",
  "general_forum_topic_unhidden",
  "video_chat_scheduled",
  "video_chat_started",
  "video_chat_ended",
  "video_chat_participants_invited",
  "boost_added",
  "giveaway_created",
  "giveaway",
  "giveaway_winners",
  "giveaway_completed"
];

function nonReplyableServiceField(message) {
  return NON_REPLYABLE_SERVICE_FIELDS.find(field =>
    Object.prototype.hasOwnProperty.call(message || {}, field) &&
    message[field] !== undefined &&
    message[field] !== null
  ) || null;
}

function normalizeTelegramMessage(update, connectionId) {
  const message = update.message;
  if (!message) return null;

  if (!["group", "supergroup"].includes(message.chat.type)) {
    return null;
  }

  if (!message.from) return null;
  if (nonReplyableServiceField(message)) return null;

  const messageType = message.text
    ? "TEXT"
    : message.photo
    ? "PHOTO"
    : message.document
    ? "DOCUMENT"
    : message.sticker
    ? "STICKER"
    : "OTHER";

  return {
    eventId: `telegram:${connectionId}:${message.chat.id}:${message.message_id}`,
    eventType: "channel.message.received",
    schemaVersion: 1,
    platform: "TELEGRAM",
    connectionId: String(connectionId),
    conversation: {
      externalId: String(message.chat.id),
      title: message.chat.title || null,
      type: "GROUP"
    },
    sender: {
      externalId: String(message.from.id),
      isBot: message.from.is_bot === true,
      displayName: [message.from.first_name, message.from.last_name]
        .filter(Boolean)
        .join(" ") || null,
      username: message.from.username || null,
      isMonitor: false
    },
    message: {
      externalId: String(message.message_id),
      replyToExternalMessageId:
        message.reply_to_message?.message_id != null
          ? String(message.reply_to_message.message_id)
          : null,
      type: messageType,
      content: message.text || message.caption || null,
      sentAt: new Date(message.date * 1000).toISOString()
    }
  };
}

module.exports = { normalizeTelegramMessage, nonReplyableServiceField };
