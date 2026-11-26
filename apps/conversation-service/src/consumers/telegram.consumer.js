const { createReliableConsumer } = require("../messaging/reliable.consumer");
const conversationService = require(
  "../services/conversation.service"
);

async function startTelegramConsumer() {
  return createReliableConsumer({
    rabbitUrl: process.env.RABBITMQ_URL,
    mainQueue: "conversation.telegram.events",
    handler: async event => {
      if (
        event.eventType !== "channel.message.received" ||
        !event.eventId ||
        event.platform !== "TELEGRAM" ||
        !event.conversation?.externalId ||
        !event.message?.externalId ||
        !event.sender?.externalId
      ) {
        const error = new Error(
          "Invalid Telegram conversation event"
        );
        error.code = "INVALID_EVENT";
        throw error;
      }

      const result = await conversationService.processTelegramMessage(
        event
      );

      if (result.ignored) {
        console.log("Conversation message ignored:", {
          conversationId: event.conversation.externalId,
          reason: result.reason
        });
        return;
      }

      console.log("Conversation saved:", {
        eventId: event.eventId,
        messageId: result.messageId,
        duplicate: result.duplicate,
        conversationId: event.conversation.externalId,
        sender: {
          id: event.sender.externalId,
          name: event.sender.displayName || null,
          username: event.sender.username || null,
          isBot: event.sender.isBot,
          type: result.senderType
        },
        replyToMessageId: event.message.replyToExternalMessageId,
        messageType: event.message.type,
        content: event.message.content
          ? String(event.message.content).slice(0, 1000)
          : null,
        contentTruncated: String(event.message.content || "").length > 1000
      });
    }
  });
}

module.exports = { startTelegramConsumer };
