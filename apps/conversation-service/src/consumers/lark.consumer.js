const {
  createReliableConsumer
} = require("../messaging/reliable.consumer");

const {
  processLarkMessage
} = require("../services/lark-conversation.service");

function validateLarkEvent(event) {
  const valid =
    event?.eventType === "channel.message.received" &&
    event.platform === "LARK" &&
    typeof event.eventId === "string" &&
    event.eventId.length > 0 &&
    /^[1-9]\d*$/.test(String(event.connectionId)) &&
    event.conversation?.type === "GROUP" &&
    typeof event.conversation?.externalId === "string" &&
    event.conversation.externalId.startsWith("oc_") &&
    typeof event.message?.externalId === "string" &&
    event.message.externalId.startsWith("om_") &&
    typeof event.message?.sentAt === "string" &&
    Number.isFinite(Date.parse(event.message.sentAt)) &&
    typeof event.sender?.externalId === "string" &&
    event.sender.externalId.length > 0;

  if (!valid) {
    const error = new Error("Invalid Lark message event");
    error.code = "INVALID_EVENT";
    throw error;
  }
}

async function startLarkConsumer() {
  return createReliableConsumer({
    rabbitUrl: process.env.RABBITMQ_URL,

    mainQueue: "conversation.lark.events",

    handler: async event => {
      validateLarkEvent(event);

      const result = await processLarkMessage(event);

      console.log("Lark message processed:", {
        eventId: event.eventId,
        conversationId: result.conversationId,
        messageId: result.messageId,
        duplicate: result.duplicate
      });
    }
  });
}

module.exports = {
  startLarkConsumer
};
