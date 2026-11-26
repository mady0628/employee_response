const pool = require("../config/database");

async function receiveEvent(event) {
  if (
    event.eventType !== "conversation.message.saved" ||
    typeof event.eventId !== "string" ||
    !/^[1-9]\d*$/.test(String(event.conversationId)) ||
    !/^[1-9]\d*$/.test(String(event.platformMessageId))
  ) {
    throw new Error("Invalid conversation event");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Tạo trạng thái xử lý cho conversation.
    await client.query(
      `INSERT INTO sla_conversation_processing (
         conversation_id
       )
       VALUES ($1)
       ON CONFLICT DO NOTHING`,
      [event.conversationId]
    );

    // Lưu event, chống trùng bằng event_id.
    const result = await client.query(
      `INSERT INTO sla_event_inbox (
         event_id,
         conversation_id,
         platform_message_id,
         payload
       )
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [
        event.eventId,
        event.conversationId,
        event.platformMessageId,
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

module.exports = { receiveEvent };
