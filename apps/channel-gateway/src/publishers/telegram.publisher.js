const amqp = require("amqplib");
const { superviseRabbitConnection } = require("../../../../shared/rabbitmq-lifecycle");

const QUEUE = "conversation.telegram.events";

let connection;
let channel;

async function connectRabbitMQ() {
  connection = await amqp.connect(
    process.env.RABBITMQ_URL
  );

  superviseRabbitConnection(connection, "gateway-telegram-publisher");
  connection.on("close", () => { channel = null; });

  channel = await connection.createConfirmChannel();
  await channel.assertQueue(QUEUE, { durable: true });

  console.log("Telegram RabbitMQ publisher ready");
}

async function publishTelegramEvent(event) {
  if (!channel) {
    throw new Error("RabbitMQ publisher not ready");
  }

  const payload = Buffer.from(JSON.stringify(event));

  // Confirm channel: chờ broker xác nhận nhận message.
  await new Promise((resolve, reject) => {
    channel.sendToQueue(
      QUEUE,
      payload,
      { persistent: true, contentType: "application/json" },
      (error) => error ? reject(error) : resolve()
    );
  });
}

module.exports = { connectRabbitMQ, publishTelegramEvent, isReady: () => Boolean(channel) };
