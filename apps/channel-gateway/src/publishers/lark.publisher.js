const amqp = require("amqplib");
const { superviseRabbitConnection } = require("../../../../shared/rabbitmq-lifecycle");

const QUEUE = "conversation.lark.events";
const REACTION_QUEUE = "conversation.lark.reactions";

let connection = null;
let channel = null;

async function connectLarkPublisher() {
  connection = await amqp.connect(
    process.env.RABBITMQ_URL
  );

  channel = await connection.createConfirmChannel();
  superviseRabbitConnection(connection, "gateway-lark-publisher");

  await channel.assertQueue(QUEUE, {
    durable: true
  });

  await channel.assertQueue(REACTION_QUEUE, {
    durable: true
  });

  connection.on("close", () => {
    channel = null;
  });

  console.log(`Lark Publisher ready: ${QUEUE}, ${REACTION_QUEUE}`);
}

async function publishLarkMessage(event) {
  if (!channel) {
    throw new Error("Lark Publisher is not connected");
  }

  const content = Buffer.from(JSON.stringify(event));

  await new Promise((resolve, reject) => {
    channel.sendToQueue(
      QUEUE,
      content,
      {
        persistent: true,
        contentType: "application/json",
        messageId: event.eventId
      },
      error => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      }
    );
  });
}

async function publishLarkReaction(event) {
  if (!channel) {
    throw new Error("Lark RabbitMQ not connected");
  }

  await new Promise((resolve, reject) => {
    channel.sendToQueue(
      REACTION_QUEUE,
      Buffer.from(JSON.stringify(event)),
      {
        persistent: true,
        contentType: "application/json",
        messageId: event.eventId
      },
      error => error ? reject(error) : resolve()
    );
  });
}

module.exports = {
  connectLarkPublisher,
  publishLarkMessage,
  publishLarkReaction,
  isReady: () => Boolean(channel)
};
