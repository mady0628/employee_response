const pool = require("../config/database");

async function saveLarkMessage({
  event,
  senderType,
  employeeId
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Kiểm tra Lark connection tồn tại và ACTIVE.
    const connection = await client.query(
      `SELECT id
       FROM channel_connections
       WHERE id = $1
         AND platform = 'LARK'
         AND status = 'ACTIVE'`,
      [event.connectionId]
    );

    if (connection.rowCount === 0) {
      const error = new Error(
        "Lark channel connection does not exist or is inactive"
      );
      error.code = "INVALID_EVENT";
      throw error;
    }

    const monitoredGroup = await client.query(
      `SELECT status, monitoring_started_at FROM monitored_groups
       WHERE channel_connection_id = $1 AND external_group_id = $2
       FOR SHARE`,
      [event.connectionId, event.conversation.externalId]
    );
    if (monitoredGroup.rowCount && (
      monitoredGroup.rows[0].status !== "ACTIVE" ||
      new Date(event.message.sentAt) < new Date(monitoredGroup.rows[0].monitoring_started_at)
    )) {
      await client.query("COMMIT");
      return {
        ignored: true,
        reason: monitoredGroup.rows[0].status !== "ACTIVE"
          ? "MONITORED_GROUP_DISABLED"
          : "BEFORE_MONITORING_START"
      };
    }

    await client.query(
      `INSERT INTO monitored_groups (
         channel_connection_id, external_group_id, group_name, status,
         monitoring_started_at, discovered_at, last_seen_at
       ) VALUES ($1, $2, $3, 'ACTIVE', $4, NOW(), NOW())
       ON CONFLICT (channel_connection_id, external_group_id)
       DO UPDATE SET group_name = COALESCE(EXCLUDED.group_name, monitored_groups.group_name),
                     last_seen_at = NOW(), updated_at = NOW()`,
      [event.connectionId, event.conversation.externalId, event.conversation.title?.slice(0, 255) || null, event.message.sentAt]
    );

    // 2. Tạo group mới hoặc cập nhật group đã có.
    const conversationResult = await client.query(
      `INSERT INTO conversations (
         channel_connection_id,
         platform,
         external_chat_id,
         title,
         chat_type,
         status
       )
       VALUES (
         $1,
         'LARK',
         $2,
         $3,
         'GROUP',
         'ACTIVE'
       )
       ON CONFLICT (
         channel_connection_id,
         external_chat_id
       )
       DO UPDATE SET
         title = COALESCE(
           EXCLUDED.title,
           conversations.title
         ),
         updated_at = NOW()
       WHERE conversations.status = 'ACTIVE'
       RETURNING id`,
      [
        event.connectionId,
        event.conversation.externalId,
        event.conversation.title
      ]
    );

    if (!conversationResult.rowCount) {
      await client.query("COMMIT");
      return { ignored: true, reason: "CONVERSATION_READING_DISABLED" };
    }
    const conversationId = conversationResult.rows[0].id;

    // 3. Insert message.
    // Không insert lại nếu Lark gửi trùng message_id.
    const messageResult = await client.query(
      `INSERT INTO messages (
         conversation_id,
         platform_message_id,
         sender_platform_id,
         sender_type,
         employee_id,
         reply_to_platform_message_id,
         message_type,
         content,
         sent_at
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9
       )
       ON CONFLICT (
         conversation_id,
         platform_message_id
       )
       DO NOTHING
       RETURNING id`,
      [
        conversationId,
        event.message.externalId,
        event.sender.externalId,
        senderType,
        employeeId,
        event.message.replyToExternalMessageId,
        event.message.type,
        event.message.content,
        event.message.sentAt
      ]
    );

    const inserted = messageResult.rowCount > 0;

    let messageId;

    if (inserted) {
      messageId = messageResult.rows[0].id;
    } else {
      const existing = await client.query(
        `SELECT id
         FROM messages
         WHERE conversation_id = $1
           AND platform_message_id = $2`,
        [
          conversationId,
          event.message.externalId
        ]
      );

      messageId = existing.rows[0]?.id;

      if (!messageId) {
        throw new Error(
          "Duplicate message lookup failed"
        );
      }
    }

    if (inserted) {
      const slaEvent = {
        eventId: `lark-conversation-message-${messageId}`,
        eventType: "conversation.message.saved",
        schemaVersion: 1,

        platform: "LARK",

        conversationId: String(conversationId),
        messageId: String(messageId),

        platformMessageId: event.message.externalId,

        senderPlatformId: event.sender.externalId,
        senderType,

        employeeId: employeeId
          ? String(employeeId)
          : null,

        replyToPlatformMessageId:
          event.message.replyToExternalMessageId,

        sentAt: event.message.sentAt
      };

      await client.query(
        `INSERT INTO conversation_outbox (
           event_id,
           event_type,
           payload
         )
         VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (event_id) DO NOTHING`,
        [
          slaEvent.eventId,
          slaEvent.eventType,
          JSON.stringify(slaEvent)
        ]
      );
    }

    await client.query("COMMIT");

    return {
      conversationId: String(conversationId),
      messageId: String(messageId),
      duplicate: !inserted
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  saveLarkMessage
};
