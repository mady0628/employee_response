const amqp = require("amqplib");
const { superviseRabbitConnection } = require("../../../../shared/rabbitmq-lifecycle");

const RETRY_DELAYS = [
  5000,
  30000,
  120000
];

function isPermanentError(error) {
  return (
    error instanceof SyntaxError ||
    error.code === "INVALID_EVENT"
  );
}

async function createReliableConsumer({ rabbitUrl, mainQueue, handler }) {
  const connection = await amqp.connect(rabbitUrl);
  const channel = await connection.createConfirmChannel();

  const deadQueue = `${mainQueue}.dead`;
  const retryQueues = RETRY_DELAYS.map(
    (_, index) => `${mainQueue}.retry.${index + 1}`
  );

  // 1. Main queue
  await channel.assertQueue(mainQueue, { durable: true });

  // 2. Dead Letter Queue
  await channel.assertQueue(deadQueue, { durable: true });

  // 3. Retry queues
  for (let i = 0; i < retryQueues.length; i++) {
    await channel.assertQueue(retryQueues[i], {
      durable: true,
      arguments: {
        "x-message-ttl": RETRY_DELAYS[i],
        "x-dead-letter-exchange": "",
        "x-dead-letter-routing-key": mainQueue
      }
    });
  }

  channel.prefetch(1);

  async function publishConfirmed(
    queue,
    content,
    properties
  ) {
    await new Promise((resolve, reject) => {
      channel.sendToQueue(
        queue,
        content,
        {
          persistent: true,
          contentType: properties.contentType || "application/json",
          messageId: properties.messageId,
          headers: properties.headers || {}
        },
        error => {
          if (error) reject(error);
          else resolve();
        }
      );
    });
  }

  await channel.consume(
    mainQueue,
    async msg => {
      if (!msg) return;

      const retryCount = Number(
        msg.properties.headers?.["x-retry-count"] || 0
      );

      try {
        const event = JSON.parse(
          msg.content.toString("utf8")
        );

        await handler(event);

        // Chỉ ACK sau khi handler hoàn thành.
        channel.ack(msg);
      } catch (error) {
        const permanent = isPermanentError(error);
        const nextRetryCount = retryCount + 1;
        const shouldDeadLetter =
          permanent || retryCount >= RETRY_DELAYS.length;

        const targetQueue = shouldDeadLetter
          ? deadQueue
          : retryQueues[retryCount];

        const headers = {
          ...msg.properties.headers,
          "x-retry-count": nextRetryCount,
          "x-error-type": permanent ? "PERMANENT" : "TRANSIENT"
        };

        console.error(
          `RabbitMQ processing failed: ${mainQueue}`,
          { retryCount, error: error.message, targetQueue }
        );

        try {
          await publishConfirmed(
            targetQueue,
            msg.content,
            {
              contentType: msg.properties.contentType,
              messageId: msg.properties.messageId,
              headers
            }
          );

          // Message đã được lưu sang queue đích.
          channel.ack(msg);
        } catch (publishError) {
          console.error(
            "Failed to republish RabbitMQ message:",
            publishError.message
          );

          // Không ACK khi chưa xác nhận publish thành công.
          // Đóng kết nối để RabbitMQ giao lại message gốc.
          try {
            await connection.close();
          } catch {
            // Connection có thể đã đóng.
          }
        }
      }
    },
    { noAck: false }
  );

  superviseRabbitConnection(connection, `consumer:${mainQueue}`);

  console.log(`Reliable Consumer ready: ${mainQueue}`);

  return { connection, channel, mainQueue, retryQueues, deadQueue };
}

module.exports = { createReliableConsumer };
