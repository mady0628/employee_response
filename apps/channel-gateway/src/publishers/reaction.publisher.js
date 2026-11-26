const amqp = require("amqplib");
const { superviseRabbitConnection } = require("../../../../shared/rabbitmq-lifecycle");

const QUEUE = "conversation.telegram.reactions";

let connection;
let channel;

async function connectReactionPublisher() {
  connection = await amqp.connect(
    process.env.RABBITMQ_URL
  );
  superviseRabbitConnection(connection, "gateway-reaction-publisher");

  channel = await connection.createConfirmChannel();
  connection.on("close", () => { channel = null; });

  await channel.assertQueue(QUEUE, {
    durable: true
  });

  console.log("Reaction Publisher ready");
}

async function publishReaction(event) {
  if (!channel) {
    throw new Error("Reaction Publisher is not ready");
  }

  const payload = Buffer.from(JSON.stringify(event));

  await new Promise((resolve, reject) => {
    channel.sendToQueue(
      QUEUE,
      payload,
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
  connectReactionPublisher,
  publishReaction,
  isReady: () => Boolean(channel)
};
