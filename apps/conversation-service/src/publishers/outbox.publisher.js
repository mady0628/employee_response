const amqp = require("amqplib");
const pool = require("../config/database");
const { superviseRabbitConnection } = require("../../../../shared/rabbitmq-lifecycle");

const TELEGRAM_SLA_QUEUE = "sla.conversation.events";
const LARK_SLA_QUEUE = "sla.lark.events";
const WHATSAPP_SLA_QUEUE = "sla.whatsapp.events";

let rabbitConnection;
let rabbitChannel;

async function connectPublisher() {
  rabbitConnection = await amqp.connect(
    process.env.RABBITMQ_URL
  );

  rabbitChannel = await rabbitConnection.createConfirmChannel();
  await rabbitChannel.assertQueue(TELEGRAM_SLA_QUEUE, { durable: true });
  await rabbitChannel.assertQueue(LARK_SLA_QUEUE, { durable: true });
  await rabbitChannel.assertQueue(WHATSAPP_SLA_QUEUE, { durable: true });

  rabbitConnection.on("close", () => {
    rabbitChannel = null;
    rabbitConnection = null;
  });
  superviseRabbitConnection(rabbitConnection, "conversation-outbox-publisher");

  console.log("Conversation Outbox RabbitMQ publisher ready");
}

async function publishPendingEvents() {
  if (!rabbitChannel) return;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `SELECT id, event_id, payload
       FROM conversation_outbox
       WHERE published_at IS NULL
       ORDER BY id
       LIMIT 50
       FOR UPDATE SKIP LOCKED`
    );

    for (const event of result.rows) {
      const platform = event.payload?.platform || "TELEGRAM";

      if (!["TELEGRAM", "LARK", "WHATSAPP"].includes(platform)) {
        throw new Error(
          `Unsupported platform in outbox: ${platform}`
        );
      }

      let targetQueue;
      switch (platform) {
        case "TELEGRAM":
          targetQueue = TELEGRAM_SLA_QUEUE;
          break;
        case "LARK":
          targetQueue = LARK_SLA_QUEUE;
          break;
        case "WHATSAPP":
          targetQueue = WHATSAPP_SLA_QUEUE;
          break;
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }

      const body = Buffer.from(
        JSON.stringify(event.payload)
      );

      await new Promise((resolve, reject) => {
        rabbitChannel.sendToQueue(
          targetQueue,
          body,
          {
            persistent: true,
            contentType: "application/json",
            messageId: event.event_id
          },
          error => error ? reject(error) : resolve()
        );
      });

      await client.query(
        `UPDATE conversation_outbox
         SET published_at = NOW()
         WHERE id = $1`,
        [event.id]
      );
    }

    await client.query("COMMIT");

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Outbox publish failed:", error.message);
  } finally {
    client.release();
  }
}

function startOutboxWorker() {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await publishPendingEvents();
    } finally {
      running = false;
    }
  }, 1000);

  return timer;
}

module.exports = { connectPublisher, startOutboxWorker, publishPendingEvents };
