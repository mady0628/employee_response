const amqp = require("amqplib");
const { superviseRabbitConnection } = require("../../../../shared/rabbitmq-lifecycle");
const QUEUE = "conversation.whatsapp.events";
const REACTION_QUEUE = "conversation.whatsapp.reactions";
let connection;
let channel;

async function connectWhatsAppPublisher() {
  connection = await amqp.connect(process.env.RABBITMQ_URL);
  superviseRabbitConnection(connection, "gateway-whatsapp-publisher");
  connection.on("close", () => { channel = null; });
  channel = await connection.createConfirmChannel();
  await channel.assertQueue(QUEUE, { durable: true });
  await channel.assertQueue(REACTION_QUEUE, { durable: true });
  console.log("WhatsApp Publisher connected");
}

async function publishWhatsAppMessage(event) {
  if (!channel) {
    throw new Error("WhatsApp publisher not connected");
  }
  await new Promise((resolve, reject) => {
    channel.sendToQueue(
      QUEUE,
      Buffer.from(JSON.stringify(event)),
      {
        persistent: true,
        contentType: "application/json",
        messageId: event.eventId
      },
      error => {
        if (error) reject(error);
        else resolve();
      }
    );
  });
}

async function publishWhatsAppReaction(event) {
  if (!channel) {
    throw new Error("WhatsApp publisher not connected");
  }
  await new Promise((resolve, reject) => {
    channel.sendToQueue(
      REACTION_QUEUE,
      Buffer.from(JSON.stringify(event)),
      {
        persistent: true,
        contentType: "application/json",
        messageId: event.eventId || event.reactionId
      },
      error => {
        if (error) reject(error);
        else resolve();
      }
    );
  });
}

module.exports = {
  connectWhatsAppPublisher,
  publishWhatsAppMessage,
  publishWhatsAppReaction,
  isReady: () => Boolean(channel)
};
