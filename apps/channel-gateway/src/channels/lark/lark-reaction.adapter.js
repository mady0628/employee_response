const crypto = require("node:crypto");

function normalizeLarkReaction(data, connectionId) {
  const emojiType = data?.reaction_type?.emoji_type;
  if (typeof emojiType !== "string" || !emojiType.trim()) {
    return null;
  }

  if (data.operator_type !== "user") {
    return null;
  }

  const openId = data.user_id?.open_id;
  const messageId = data.message_id;
  const actionMillis = Number(data.action_time);

  if (
    !openId ||
    !messageId ||
    !Number.isSafeInteger(actionMillis) ||
    actionMillis <= 0
  ) {
    throw new Error("Invalid Lark reaction event");
  }

  // EventDispatcher chuyển phần event data tới handler.
  // Dùng dấu vết ổn định của reaction để chống trùng.
  const fingerprint = [
    connectionId,
    messageId,
    openId,
    data.action_time,
    emojiType
  ].join(":");

  const eventHash = crypto
    .createHash("sha256")
    .update(fingerprint)
    .digest("hex");

  return {
    eventId: `lark-reaction:${eventHash}`,
    eventType: "channel.message.reaction_added",
    schemaVersion: 1,

    platform: "LARK",
    connectionId: String(connectionId),
    targetMessageId: String(messageId),
    actorOpenId: String(openId),
    emojiType,
    reactedAt: new Date(actionMillis).toISOString()
  };
}

module.exports = {
  normalizeLarkReaction
};
