const { createReliableConsumer } = require("../messaging/reliable.consumer");
const { processWhatsAppMessage } = require("../services/whatsapp-conversation.service");

async function startWhatsAppConsumer() {
  return createReliableConsumer({
    rabbitUrl: process.env.RABBITMQ_URL,
    mainQueue: "conversation.whatsapp.events",
    handler: async event => {
      const result = await processWhatsAppMessage(event);
      console.log("WhatsApp processed:", {
        eventId: event.eventId,
        conversationId: event.conversation?.externalId,
        messageId: event.message?.externalId,
        senderId: event.sender?.externalId,
        senderType: result.senderType || null,
        content: event.message?.content ?? null,
        result
      });
    }
  });
}

module.exports = { startWhatsAppConsumer };
