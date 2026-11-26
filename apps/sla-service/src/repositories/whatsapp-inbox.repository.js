const pool = require("../config/database");

function invalidEvent(message) {
  const error = new Error(message);
  error.code = "INVALID_EVENT";
  return error;
}

async function receiveWhatsAppEvent(event) {
  if (
    event?.eventType !== "conversation.message.saved" ||
    event.platform !== "WHATSAPP" ||
    !event.eventId ||
    !event.conversationId ||
    !event.messageId ||
    !event.platformMessageId ||
    !["EMPLOYEE", "CUSTOMER"].includes(
      event.senderType
    ) ||
    !Number.isFinite(Date.parse(event.sentAt))
  ) {
    throw invalidEvent("Invalid WhatsApp SLA event");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Kiểm tra event thật sự tương ứng với
    // message đã lưu và group WhatsApp hợp lệ.
    const messageResult = await client.query(
      `SELECT
         m.id,
         m.sent_at,
         m.sender_type,
         c.id AS conversation_id,
         c.monitoring_started_at
       FROM messages m
       JOIN conversations c
         ON c.id = m.conversation_id
       WHERE m.id = $1
         AND c.id = $2
         AND c.platform = 'WHATSAPP'
         AND c.status = 'ACTIVE'
         AND m.platform_message_id = $3`,
      [
        event.messageId,
        event.conversationId,
        event.platformMessageId
      ]
    );

    if (!messageResult.rowCount) {
      // Dữ liệu chưa có hoặc không khớp.
      // Trả lỗi để retry, không ACK âm thầm.
      throw new Error(
        "WhatsApp source message not found"
      );
    }

    const message = messageResult.rows[0];

    if (
      message.sender_type !== event.senderType ||
      !message.monitoring_started_at ||
      new Date(message.sent_at) <
        new Date(message.monitoring_started_at)
    ) {
      throw invalidEvent(
        "WhatsApp message not eligible for SLA"
      );
    }

    // Tạo trạng thái xử lý cho conversation.
    await client.query(
      `INSERT INTO whatsapp_sla_processing (
         conversation_id
       )
       VALUES ($1)
       ON CONFLICT DO NOTHING`,
      [event.conversationId]
    );

    const inserted = await client.query(
      `INSERT INTO whatsapp_sla_inbox (
         event_id,
         conversation_id,
         platform_message_id,
         message_sent_at,
         payload
       )
       VALUES (
         $1, $2, $3, $4, $5::jsonb
       )
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [
        event.eventId,
        event.conversationId,
        event.platformMessageId,
        message.sent_at,
        JSON.stringify(event)
      ]
    );

    await client.query("COMMIT");

    return {
      inserted: inserted.rowCount > 0
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  receiveWhatsAppEvent
};
