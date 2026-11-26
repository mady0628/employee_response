const {
  createReliableConsumer
} = require("../messaging/reliable.consumer");

const {
  receiveLarkEvent
} = require("../repositories/lark-inbox.repository");

async function startLarkConsumer() {
  return createReliableConsumer({
    rabbitUrl: process.env.RABBITMQ_URL,

    mainQueue: "sla.lark.events",

    handler: async event => {
      const result = await receiveLarkEvent(event);

      console.log("Lark SLA event received:", {
        eventId: event.eventId,
        inserted: result.inserted
      });
    }
  });
}

module.exports = {
  startLarkConsumer
};
