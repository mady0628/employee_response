const pool = require("../config/database");

async function receiveLarkEvent(event) {
  if (
    event.eventType !== "conversation.message.saved" ||
    event.platform !== "LARK" ||
    !event.eventId ||
    !event.conversationId ||
    !event.messageId ||
    !event.platformMessageId ||
    !Number.isFinite(Date.parse(event.sentAt))
  ) {
    const error = new Error("Invalid Lark SLA event");
    error.code = "INVALID_EVENT";
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Chỉ nhận event thuộc conversation Lark đã được Conversation Service lưu.
    const conversation = await client.query(
      `SELECT id
       FROM conversations
       WHERE id = $1
         AND platform = 'LARK'`,
      [event.conversationId]
    );

    if (conversation.rowCount === 0) {
      const error = new Error(
        "Lark conversation not found"
      );
      error.code = "INVALID_EVENT";
      throw error;
    }

    await client.query(
      `INSERT INTO lark_sla_processing (
         conversation_id
       )
       VALUES ($1)
       ON CONFLICT DO NOTHING`,
      [event.conversationId]
    );

    const result = await client.query(
      `INSERT INTO lark_sla_inbox (
         event_id,
         conversation_id,
         platform_message_id,
         message_sent_at,
         payload
       )
       VALUES ($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [
        event.eventId,
        event.conversationId,
        event.platformMessageId,
        event.sentAt,
        JSON.stringify(event)
      ]
    );

    await client.query("COMMIT");

    return {
      inserted: result.rowCount > 0
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  receiveLarkEvent
};
