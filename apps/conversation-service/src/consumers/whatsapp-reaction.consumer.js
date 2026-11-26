const {
  createReliableConsumer
} = require("../messaging/reliable.consumer");

const {
  saveWhatsAppReaction
} = require(
  "../repositories/whatsapp-reaction.repository"
);

async function startWhatsAppReactionConsumer() {
  return createReliableConsumer({
    rabbitUrl: process.env.RABBITMQ_URL,

    mainQueue: "conversation.whatsapp.reactions",

    handler: async event => {
      const valid =
        event?.eventType ===
          "channel.message.reaction_added" &&
        event.platform === "WHATSAPP" &&
        event.reactionType === "EMOJI" &&
        typeof event.emoji === "string" &&
        event.emoji.trim().length > 0 &&
        typeof event.eventId === "string" &&
        event.eventId.length > 0 &&
        /^[1-9]\d*$/.test(
          String(event.connectionId)
        ) &&
        typeof event.targetMessageId === "string" &&
        event.targetMessageId.length > 0 &&
        typeof event.actorPlatformId === "string" &&
        event.actorPlatformId.length > 0 &&
        Number.isFinite(Date.parse(event.reactedAt));

      if (!valid) {
        const error = new Error(
          "Invalid WhatsApp reaction"
        );
        error.code = "INVALID_EVENT";
        throw error;
      }

      const result = await saveWhatsAppReaction(
        event
      );

      console.log("Reaction saved:", {
        eventId: event.eventId,
        inserted: result.inserted
      });
    }
  });
}

module.exports = {
  startWhatsAppReactionConsumer
};
