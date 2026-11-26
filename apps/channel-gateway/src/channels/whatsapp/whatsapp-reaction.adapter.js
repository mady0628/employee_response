const crypto = require("node:crypto");

function serializedId(value) {
  if (typeof value === "string") {
    return value;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  if (typeof value._serialized === "string") {
    return value._serialized;
  }

  if (typeof value.$1 === "string") {
    return value.$1;
  }

  // Reaction IDs may contain a raw MessageId object without _serialized
  // after WhatsApp Web's ID representation changes.
  const part = item => {
    if (typeof item === "string") return item;
    if (typeof item?._serialized === "string") return item._serialized;
    if (typeof item?.$1 === "string") return item.$1;
    return null;
  };
  const remote = part(value.remote);
  const message = part(value.id);
  const participant = part(value.participant);

  if (typeof value.fromMe === "boolean" && remote && message) {
    return [
      value.fromMe ? "true" : "false",
      remote,
      message,
      participant
    ].filter(Boolean).join("_");
  }

  return null;
}

function normalizeWhatsAppReaction(
  reaction,
  connectionId
) {
  // whatsapp-web.js phát reaction có nội dung khi thêm/thay đổi emoji;
  // khi gỡ reaction thì reaction thường là chuỗi rỗng.
  const emoji = typeof reaction?.reaction === "string"
    ? reaction.reaction.trim()
    : "";
  if (!emoji) {
    return null;
  }

  const targetMessageId =
    serializedId(reaction.msgId);

  const reactionId =
    serializedId(reaction.id);

  const actorPlatformId =
    serializedId(reaction.senderId);

  const timestamp = Number(reaction.timestamp);
  const reactedAt = new Date(timestamp * 1000);

  const missingFields = [
    !targetMessageId && "targetMessageId",
    !actorPlatformId && "actorPlatformId",
    (!Number.isFinite(timestamp) || timestamp <= 0 ||
      !Number.isFinite(reactedAt.getTime())) && "timestamp"
  ].filter(Boolean);

  if (missingFields.length > 0) {
    const error = new Error(
      `Invalid WhatsApp reaction event; missing/invalid: ${missingFields.join(", ")}`
    );
    error.reactionDebug = {
      targetMessageId,
      reactionId,
      actorPlatformId,
      timestamp: reaction.timestamp,
      orphan: reaction.orphan,
      orphanReason: reaction.orphanReason
    };
    throw error;
  }

  const rawId = [
    connectionId,
    targetMessageId,
    actorPlatformId,
    timestamp,
    emoji
  ].join(":");

  const hash = crypto
    .createHash("sha256")
    .update(rawId)
    .digest("hex");

  return {
    eventId: `whatsapp-reaction:${hash}`,

    eventType: "channel.message.reaction_added",
    schemaVersion: 1,

    platform: "WHATSAPP",
    connectionId: String(connectionId),

    targetMessageId,
    actorPlatformId,

    reactionType: "EMOJI",
    emoji,

    reactedAt: reactedAt.toISOString()
  };
}

module.exports = {
  serializedId,
  normalizeWhatsAppReaction
};
