const {
  createReliableConsumer
} = require("../messaging/reliable.consumer");

const reactionRepository = require(
  "../repositories/reaction.repository"
);

async function startReactionConsumer() {
  return createReliableConsumer({
    rabbitUrl: process.env.RABBITMQ_URL,

    mainQueue: "conversation.telegram.reactions",

    handler: async event => {
      if (
        event.eventType !== "channel.message.reaction_added" ||
        event.platform !== "TELEGRAM" ||
        event.reaction?.type !== "EMOJI_ADDED" ||
        !event.eventId ||
        !event.actor?.externalId ||
        !event.targetMessage?.externalId
      ) {
        const error = new Error("Invalid reaction event");
        error.code = "INVALID_EVENT";
        throw error;
      }

      await reactionRepository.saveReactionEvent(event);
    }
  });
}

module.exports = {
  startReactionConsumer
};
