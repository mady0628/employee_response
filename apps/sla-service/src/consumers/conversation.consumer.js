const { createReliableConsumer } = require("../messaging/reliable.consumer");
const inboxRepository = require(
  "../repositories/sla-inbox.repository"
);

async function startConversationConsumer() {
  return createReliableConsumer({
    rabbitUrl: process.env.RABBITMQ_URL,
    mainQueue: "sla.conversation.events",
    handler: async event => {
      if (
        event.eventType !== "conversation.message.saved" ||
        !event.eventId ||
        !/^[1-9]\d*$/.test(String(event.conversationId)) ||
        !/^[1-9]\d*$/.test(String(event.platformMessageId))
      ) {
        const error = new Error(
          "Invalid SLA conversation event"
        );
        error.code = "INVALID_EVENT";
        throw error;
      }

      const result = await inboxRepository.receiveEvent(
        event
      );

      console.log("SLA event stored:", {
        eventId: event.eventId,
        inserted: result.inserted
      });
    }
  });
}

module.exports = { startConversationConsumer };
