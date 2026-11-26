const { createReliableConsumer } = require("../messaging/reliable.consumer");
const { saveLarkReaction } = require("../repositories/lark-reaction.repository");

async function startLarkReactionConsumer() {
  return createReliableConsumer({
    rabbitUrl: process.env.RABBITMQ_URL,
    mainQueue: "conversation.lark.reactions",
    handler: async event => {
      if (
        event?.eventType !== "channel.message.reaction_added" ||
        event.platform !== "LARK" ||
        typeof event.emojiType !== "string" ||
        !event.emojiType.trim() ||
        !event.eventId ||
        !/^[1-9]\d*$/.test(String(event.connectionId)) ||
        !/^om_[A-Za-z0-9_-]+$/.test(
          String(event.targetMessageId)
        ) ||
        !/^ou_[A-Za-z0-9_-]+$/.test(
          String(event.actorOpenId)
        ) ||
        !Number.isFinite(Date.parse(event.reactedAt))
      ) {
        const error = new Error(
          "Invalid Lark reaction payload"
        );
        error.code = "INVALID_EVENT";
        throw error;
      }

      const result = await saveLarkReaction(event);
      console.log("Lark reaction saved:", {
        eventId: event.eventId,
        inserted: result.inserted
      });
    }
  });
}

module.exports = { startLarkReactionConsumer };
