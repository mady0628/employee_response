const pool = require("../config/database");

const {
  processMessageInTransaction
} = require("../services/sla.service");

const BUFFER_SECONDS = 15;

async function processNextLarkEvent(customBufferSeconds = null) {
  const bufferSeconds = customBufferSeconds !== null ? customBufferSeconds : BUFFER_SECONDS;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Chỉ chọn event đã chờ ít nhất bufferSeconds giây.
    // Không xử lý conversation đã bị đánh dấu review.
    const result = await client.query(
      `SELECT i.*
       FROM lark_sla_inbox i

       JOIN lark_sla_processing cp
         ON cp.conversation_id = i.conversation_id

       WHERE i.status = 'PENDING'
         AND cp.requires_review = FALSE

         AND i.received_at <=
           NOW() - ($1::integer * INTERVAL '1 second')

         AND NOT EXISTS (
           SELECT 1
           FROM lark_sla_inbox earlier
           WHERE earlier.conversation_id = i.conversation_id
             AND earlier.status = 'PENDING'
             AND (
               earlier.message_sent_at < i.message_sent_at
               OR (
                 earlier.message_sent_at = i.message_sent_at
                 AND earlier.id < i.id
               )
             )
         )

       ORDER BY i.received_at, i.id
       LIMIT 1
       FOR UPDATE OF i SKIP LOCKED`,
      [bufferSeconds]
    );

    if (result.rowCount === 0) {
      await client.query("COMMIT");
      return null;
    }

    const inbox = result.rows[0];

    // Khóa trạng thái xử lý của group.
    const stateResult = await client.query(
      `SELECT *
       FROM lark_sla_processing
       WHERE conversation_id = $1
       FOR UPDATE`,
      [inbox.conversation_id]
    );

    const state = stateResult.rows[0];

    if (state.requires_review) {
      await client.query("COMMIT");
      return null;
    }

    const currentTime = new Date(inbox.message_sent_at);
    const previousTime = state.last_sent_at
      ? new Date(state.last_sent_at)
      : null;

    // Event đến muộn hoặc trùng mốc thời gian với event đã xử lý: không thể chắc chắn thứ tự.
    if (
      previousTime &&
      currentTime <= previousTime
    ) {
      await client.query(
        `UPDATE lark_sla_inbox
         SET status = 'LATE',
             processed_at = NOW(),
             error_message =
               'OUT_OF_ORDER_OR_SAME_TIMESTAMP'
         WHERE id = $1`,
        [inbox.id]
      );

      await client.query(
        `UPDATE lark_sla_processing
         SET requires_review = TRUE,
             updated_at = NOW()
         WHERE conversation_id = $1`,
        [inbox.conversation_id]
      );

      await client.query("COMMIT");

      return {
        action: "REVIEW",
        reason: "OUT_OF_ORDER_OR_SAME_TIMESTAMP",
        messageId: inbox.platform_message_id
      };
    }

    const event = inbox.payload;

    const slaResult =
      await processMessageInTransaction(client, event);

    // Chỉ cập nhật cursor khi nghiệp vụ SLA đã được xử lý thành công trong transaction.
    await client.query(
      `UPDATE lark_sla_processing
       SET last_sent_at = $1,
           last_message_id = $2,
           updated_at = NOW()
       WHERE conversation_id = $3`,
      [
        inbox.message_sent_at,
        inbox.platform_message_id,
        inbox.conversation_id
      ]
    );

    await client.query(
      `UPDATE lark_sla_inbox
       SET status = 'PROCESSED',
           processed_at = NOW()
       WHERE id = $1`,
      [inbox.id]
    );

    await client.query("COMMIT");

    return {
      action: "PROCESSED",
      conversationId: inbox.conversation_id,
      messageId: inbox.platform_message_id,
      slaResult
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function startLarkInboxWorker() {
  let running = false;

  const timer = setInterval(async () => {
    if (running) return;

    running = true;

    try {
      for (let i = 0; i < 100; i++) {
        const result = await processNextLarkEvent();

        if (!result) break;

        console.log("Lark Inbox:", result);
      }
    } catch (error) {
      console.error(
        "Lark SLA Worker error:",
        error.message
      );
    } finally {
      running = false;
    }
  }, 1000);

  console.log("Lark SLA Inbox Worker started");

  return timer;
}

module.exports = {
  startLarkInboxWorker,
  processNextLarkEvent
};
