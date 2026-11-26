const {
  createReliableConsumer
} = require("../messaging/reliable.consumer");

const {
  receiveWhatsAppEvent
} = require("../repositories/whatsapp-inbox.repository");

async function startWhatsAppConsumer() {
  return createReliableConsumer({
    rabbitUrl: process.env.RABBITMQ_URL,
    mainQueue: "sla.whatsapp.events",
    handler: async event => {
      const result = await receiveWhatsAppEvent(event);
      console.log("WhatsApp SLA inbox:", {
        eventId: event.eventId,
        inserted: result.inserted,
        conversationId: event.conversationId,
        messageId: event.platformMessageId,
        senderType: event.senderType
      });
    }
  });
}

module.exports = {
  startWhatsAppConsumer
};
