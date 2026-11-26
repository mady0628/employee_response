const pool = require("../config/database");

const {
  processMessageInTransaction
} = require("../services/sla.service");

const DEFAULT_BUFFER_SECONDS = 20;

async function markReview(
  client,
  conversationId,
  inboxId,
  reason
) {
  await client.query(
    `UPDATE whatsapp_sla_processing
     SET requires_review = TRUE,
         updated_at = NOW()
     WHERE conversation_id = $1`,
    [conversationId]
  );

  await client.query(
    `UPDATE whatsapp_sla_inbox
     SET status = 'REVIEW',
         error_message = $2,
         processed_at = NOW()
     WHERE id = $1`,
    [inboxId, reason]
  );

  return {
    action: "REVIEW",
    conversationId,
    reason
  };
}

async function processNextWhatsAppEvent(bufferSeconds = DEFAULT_BUFFER_SECONDS) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Khóa trạng thái của một group có event đủ tuổi để xử lý (Query cải tiến bước 237).
    const stateResult = await client.query(
      `SELECT p.*
       FROM whatsapp_sla_processing p
       WHERE p.requires_review = FALSE
         AND EXISTS (
           SELECT 1
           FROM whatsapp_sla_inbox i
           WHERE i.conversation_id = p.conversation_id
             AND i.status = 'PENDING'
             AND i.received_at <=
               NOW() - ($1::integer * INTERVAL '1 second')
             AND NOT EXISTS (
               SELECT 1
               FROM whatsapp_sla_inbox earlier
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
         )
       ORDER BY p.conversation_id
       LIMIT 1
       FOR UPDATE OF p SKIP LOCKED`,
      [bufferSeconds]
    );

    if (!stateResult.rowCount) {
      await client.query("COMMIT");
      return null;
    }

    const state = stateResult.rows[0];

    // 2. Chọn tin sớm nhất trong group.
    const inboxResult = await client.query(
      `SELECT *
       FROM whatsapp_sla_inbox
       WHERE conversation_id = $1
         AND status = 'PENDING'
       ORDER BY message_sent_at, id
       LIMIT 1
       FOR UPDATE`,
      [state.conversation_id]
    );

    if (!inboxResult.rowCount) {
      await client.query("COMMIT");
      return null;
    }

    const inbox = inboxResult.rows[0];

    // Tin sớm nhất chưa đủ tuổi: không được xử lý các tin sau nó.
    const age = await client.query(
      `SELECT (
         $1::timestamptz <=
         NOW() - ($2::integer * INTERVAL '1 second')
       ) AS eligible`,
      [inbox.received_at, bufferSeconds]
    );

    if (!age.rows[0].eligible) {
      await client.query("COMMIT");
      return null;
    }

    // 3. Kiểm tra sender UNKNOWN có thể ảnh hưởng đến thứ tự SLA hay không.
    const unknown = await client.query(
      `SELECT 1
       FROM messages
       WHERE conversation_id = $1
         AND sender_type = 'UNKNOWN'
         AND sent_at <= $2
       LIMIT 1`,
      [state.conversation_id, inbox.message_sent_at]
    );

    if (unknown.rowCount) {
      const result = await markReview(
        client,
        state.conversation_id,
        inbox.id,
        "UNKNOWN_SENDER_BEFORE_EVENT"
      );

      await client.query("COMMIT");
      return result;
    }

    // 4. Nhiều tin cùng timestamp: Không đoán thứ tự xử lý.
    const sameTime = await client.query(
      `SELECT COUNT(*)::integer AS total
       FROM messages
       WHERE conversation_id = $1
         AND sent_at = $2`,
      [state.conversation_id, inbox.message_sent_at]
    );

    if (sameTime.rows[0].total > 1) {
      const result = await markReview(
        client,
        state.conversation_id,
        inbox.id,
        "AMBIGUOUS_MESSAGE_ORDER"
      );

      await client.query("COMMIT");
      return result;
    }

    // 5. Kiểm tra sự kiện đến muộn.
    if (
      state.last_sent_at &&
      new Date(inbox.message_sent_at) <= new Date(state.last_sent_at)
    ) {
      const result = await markReview(
        client,
        state.conversation_id,
        inbox.id,
        "LATE_MESSAGE_EVENT"
      );

      await client.query("COMMIT");
      return result;
    }

    // 6. Xử lý nghiệp vụ SLA dùng chung.
    const event = inbox.payload;

    const slaResult = await processMessageInTransaction(client, event);

    // Keep the same useful outcome detail as Telegram's Inbox result log.
    // The raw message body is fetched from the persisted message row because
    // WhatsApp SLA events intentionally contain identifiers and classification only.
    const messageResult = await client.query(
      `SELECT content
       FROM messages
       WHERE id = $1 AND conversation_id = $2`,
      [event.messageId, event.conversationId]
    );

    // 7. Cập nhật cursor.
    await client.query(
      `UPDATE whatsapp_sla_processing
       SET last_sent_at = $1,
           last_inbox_id = $2,
           updated_at = NOW()
       WHERE conversation_id = $3`,
      [inbox.message_sent_at, inbox.id, state.conversation_id]
    );

    // 8. Đánh dấu event đã xử lý.
    await client.query(
      `UPDATE whatsapp_sla_inbox
       SET status = 'PROCESSED',
           processed_at = NOW(),
           error_message = NULL
       WHERE id = $1`,
      [inbox.id]
    );

    await client.query("COMMIT");

    return {
      action: "PROCESSED",
      conversationId: state.conversation_id,
      messageId: inbox.platform_message_id,
      senderType: event.senderType,
      slaResult,
      content: messageResult.rows[0]?.content ?? null
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function startWhatsAppInboxWorker() {
  let running = false;

  const timer = setInterval(async () => {
    if (running) return;

    running = true;

    try {
      for (let i = 0; i < 100; i++) {
        const result = await processNextWhatsAppEvent();

        if (!result) break;

        console.log("WhatsApp SLA:", result);
      }
    } catch (error) {
      console.error(
        "WhatsApp SLA worker failed:",
        error.message
      );
    } finally {
      running = false;
    }
  }, 3000);

  console.log("WhatsApp SLA Worker started");

  return timer;
}

module.exports = {
  startWhatsAppInboxWorker,
  processNextWhatsAppEvent
};
