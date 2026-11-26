function reactionKey(reaction) {
  if (reaction?.type === "emoji" && reaction.emoji) {
    return `emoji:${reaction.emoji}`;
  }

  if (
    reaction?.type === "custom_emoji" &&
    reaction.custom_emoji_id
  ) {
    return `custom:${reaction.custom_emoji_id}`;
  }

  return null;
}

function normalizeReaction(update, connectionId) {
  const reaction = update.message_reaction;

  if (!reaction) return null;

  if (!["group", "supergroup"].includes(reaction.chat.type)) {
    return null;
  }

  // Reaction ẩn danh không xác định được Sales.
  if (!reaction.user || reaction.user.is_bot) {
    return null;
  }

  const oldReactionKeys = new Set(
    (reaction.old_reaction || []).map(reactionKey).filter(Boolean)
  );
  const addedReaction = (reaction.new_reaction || []).find(item => {
    const key = reactionKey(item);
    return key && !oldReactionKeys.has(key);
  });

  // Tính mọi emoji mới được thêm hoặc thay thế; không tính thao tác gỡ.
  if (!addedReaction) {
    return null;
  }

  return {
    eventId: `telegram:${connectionId}:${update.update_id}`,
    eventType: "channel.message.reaction_added",
    schemaVersion: 1,

    platform: "TELEGRAM",
    connectionId: String(connectionId),

    conversation: {
      externalId: String(reaction.chat.id)
    },

    actor: {
      externalId: String(reaction.user.id)
    },

    targetMessage: {
      externalId: String(reaction.message_id)
    },

    reaction: {
      type: "EMOJI_ADDED",
      emoji: addedReaction.emoji || null,
      customEmojiId: addedReaction.custom_emoji_id || null
    },

    reactedAt: new Date(
      reaction.date * 1000
    ).toISOString()
  };
}

module.exports = { normalizeReaction };
