const pool = require("../config/database");

const {
  processMessageInTransaction
} = require("../services/sla.service");

// Chờ 10 giây trước khi xử lý một event.
const BUFFER_SECONDS = Number(process.env.INBOX_BUFFER_SECONDS || 10);

async function processNextInboxEvent() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lấy event nhỏ nhất chưa xử lý của từng conversation.
    // Chỉ xử lý khi event đã nằm trong inbox ít nhất 10s.
    const result = await client.query(
      `SELECT i.*
       FROM sla_event_inbox i

       JOIN sla_conversation_processing cp
         ON cp.conversation_id = i.conversation_id

       WHERE i.status = 'PENDING'
         AND cp.requires_review = FALSE

         AND i.received_at <=
           NOW() - ($1::integer * INTERVAL '1 second')

         AND NOT EXISTS (
           SELECT 1
           FROM sla_event_inbox older
           WHERE older.conversation_id = i.conversation_id
             AND older.status = 'PENDING'
             AND older.platform_message_id < i.platform_message_id
         )

       ORDER BY i.received_at, i.id
       LIMIT 1

       FOR UPDATE OF i SKIP LOCKED`,
      [BUFFER_SECONDS]
    );

    if (result.rowCount === 0) {
      await client.query("COMMIT");
      return null;
    }

    const inbox = result.rows[0];

    // Khóa trạng thái conversation để xử lý tuần tự.
    const cursor = await client.query(
      `SELECT *
       FROM sla_conversation_processing
       WHERE conversation_id = $1
       FOR UPDATE`,
      [inbox.conversation_id]
    );

    const state = cursor.rows[0];

    // Đã xử lý một message ID lớn hơn trước đó.
    if (
      BigInt(inbox.platform_message_id) <=
      BigInt(state.last_message_id)
    ) {
      await client.query(
        `UPDATE sla_event_inbox
         SET status = 'LATE',
             processed_at = NOW(),
             error_message = 'OUT_OF_ORDER_MESSAGE'
         WHERE id = $1`,
        [inbox.id]
      );

      // Đóng băng xử lý SLA cho conversation này
      // để tránh tiếp tục ghi KPI có thể sai.
      await client.query(
        `UPDATE sla_conversation_processing
         SET requires_review = TRUE,
             updated_at = NOW()
         WHERE conversation_id = $1`,
        [inbox.conversation_id]
      );

      await client.query("COMMIT");

      return {
        action: "LATE_EVENT",
        conversationId: inbox.conversation_id,
        messageId: inbox.platform_message_id
      };
    }

    const event = inbox.payload;

    // Xử lý SLA bằng chính transaction hiện tại.
    const processed = await processMessageInTransaction(
      client,
      event
    );

    // Chỉ cập nhật cursor sau khi xử lý SLA thành công.
    await client.query(
      `UPDATE sla_conversation_processing
       SET last_message_id = $1,
           updated_at = NOW()
       WHERE conversation_id = $2`,
      [
        inbox.platform_message_id,
        inbox.conversation_id
      ]
    );

    await client.query(
      `UPDATE sla_event_inbox
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
      slaResult: processed
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function startInboxWorker() {
  let running = false;

  const timer = setInterval(async () => {
    if (running) return;

    running = true;

    try {
      // Xử lý tối đa 100 event trong một lượt quét.
      for (let i = 0; i < 100; i++) {
        const result = await processNextInboxEvent();

        if (!result) break;

        console.log("Inbox result:", result);
      }
    } catch (error) {
      console.error(
        "SLA Inbox Worker failed:",
        error.message
      );
    } finally {
      running = false;
    }
  }, 1000);

  console.log("SLA Inbox Worker started");

  return timer;
}

module.exports = {
  startInboxWorker,
  processNextInboxEvent
};
