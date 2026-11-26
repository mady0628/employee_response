const pool = require("../config/database");

async function isReadingEnabled(event) {
  const result = await pool.query(
    `SELECT c.status AS conversation_status, mg.status AS monitor_status
     FROM (SELECT $1::bigint AS connection_id, $2::varchar AS group_id) requested
     LEFT JOIN conversations c
       ON c.channel_connection_id = requested.connection_id
      AND c.external_chat_id = requested.group_id
     LEFT JOIN monitored_groups mg
       ON mg.channel_connection_id = requested.connection_id
      AND mg.external_group_id = requested.group_id`,
    [event.connectionId, event.conversation.externalId]
  );

  const { conversation_status, monitor_status } = result.rows[0];
  return (conversation_status === null || conversation_status === "ACTIVE") &&
    (monitor_status === null || monitor_status === "ACTIVE");
}

async function setMonitoredGroupStatus(groupId, status) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const group = await client.query(
      `UPDATE monitored_groups
       SET status = $2,
           monitoring_started_at = CASE
             WHEN $2 = 'ACTIVE' AND status <> 'ACTIVE' THEN NOW()
             ELSE monitoring_started_at
           END,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, channel_connection_id, external_group_id, status`,
      [groupId, status]
    );
    if (!group.rowCount) {
      await client.query("ROLLBACK");
      return null;
    }

    const monitoredGroup = group.rows[0];
    const conversationStatus = status === "ACTIVE" ? "ACTIVE" : "INACTIVE";
    const conversations = await client.query(
      `UPDATE conversations
       SET status = $3, updated_at = NOW()
       WHERE channel_connection_id = $1 AND external_chat_id = $2
       RETURNING id`,
      [monitoredGroup.channel_connection_id, monitoredGroup.external_group_id, conversationStatus]
    );

    if (status !== "ACTIVE" && conversations.rowCount) {
      const slas = await client.query(
        `UPDATE sla_trackings
         SET status = 'CANCELLED', next_reminder_at = NULL, updated_at = NOW()
         WHERE conversation_id = ANY($1::bigint[]) AND status = 'WAITING'
         RETURNING id`,
        [conversations.rows.map(row => row.id)]
      );
      if (slas.rowCount) {
        await client.query(
          `UPDATE reminder_jobs
           SET status = 'CANCELLED', completed_at = NOW(), claimed_at = NULL
           WHERE sla_id = ANY($1::bigint[]) AND status IN ('PENDING', 'PROCESSING')`,
          [slas.rows.map(row => row.id)]
        );
      }
    }

    await client.query("COMMIT");
    return monitoredGroup;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function saveMessage(event, senderType, employeeId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Kiểm tra bot connection đã đăng ký
    const connection = await client.query(
      `SELECT id FROM channel_connections
       WHERE id = $1 AND platform = $2 AND status = 'ACTIVE'`,
      [event.connectionId, event.platform]
    );

    if (connection.rowCount === 0) {
      throw new Error("Channel connection is not active");
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
        conversationId: null,
        messageId: null,
        duplicate: false,
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

    // Lưu hoặc cập nhật group
    const groupResult = await client.query(
      `INSERT INTO conversations (
         channel_connection_id,
         platform,
         external_chat_id,
         title,
         chat_type
       )
       VALUES ($1, $2, $3, $4, $5)
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
        event.platform,
        event.conversation.externalId,
        event.conversation.title,
        event.conversation.type
      ]
    );

    if (groupResult.rowCount === 0) {
      await client.query("COMMIT");
      return {
        conversationId: null,
        messageId: null,
        duplicate: false,
        ignored: true,
        reason: "CONVERSATION_READING_DISABLED"
      };
    }

    const conversationId = groupResult.rows[0].id;

    // Lưu message, tránh trùng Telegram message_id
    const messageResult = await client.query(
      `INSERT INTO messages (
         conversation_id,
         platform_message_id,
         sender_platform_id,
         sender_display_name,
         sender_username,
         sender_type,
         employee_id,
         reply_to_platform_message_id,
         message_type,
         content,
         sent_at
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
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
        event.sender.displayName || null,
        event.sender.username || null,
        senderType,
        employeeId,
        event.message.replyToExternalMessageId,
        event.message.type,
        event.message.content,
        event.message.sentAt
      ]
    );

    if (messageResult.rowCount > 0) {
      const messageId = messageResult.rows[0].id;
      const savedEvent = {
        eventId: `conversation-message-${messageId}`,
        eventType: "conversation.message.saved",
        schemaVersion: 1,
        conversationId: String(conversationId),
        messageId: String(messageId),
        platformMessageId: event.message.externalId,
        senderPlatformId: event.sender.externalId,
        senderDisplayName: event.sender.displayName || null,
        senderUsername: event.sender.username || null,
        senderType,
        employeeId: employeeId ? String(employeeId) : null,
        replyToPlatformMessageId: event.message.replyToExternalMessageId,
        sentAt: event.message.sentAt
      };

      await client.query(
        `INSERT INTO conversation_outbox (
           event_id,
           event_type,
           payload
         )
         VALUES ($1, $2, $3::jsonb)`,
        [
          savedEvent.eventId,
          savedEvent.eventType,
          JSON.stringify(savedEvent)
        ]
      );
    }

    await client.query("COMMIT");

    return {
      conversationId,
      messageId: messageResult.rows[0]?.id || null,
      duplicate: messageResult.rowCount === 0
    };

  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function updateConversationStatus(event) {
  await pool.query(
    `UPDATE conversations
     SET status = $1,
         updated_at = NOW()
     WHERE channel_connection_id = $2
       AND external_chat_id = $3`,
    [
      event.status,
      event.connectionId,
      event.conversation.externalId
    ]
  );
}

async function listConversations() {
  const result = await pool.query(
    `SELECT id, platform, external_chat_id, title, chat_type, status,
            (status = 'ACTIVE') AS reading_enabled, updated_at
     FROM conversations
     ORDER BY title NULLS LAST, id`
  );

  return result.rows;
}

async function setReadingEnabled(conversationId, enabled) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE conversations
       SET status = $2,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, platform, external_chat_id, title, chat_type,
                 status, (status = 'ACTIVE') AS reading_enabled,
                 channel_connection_id, updated_at`,
      [conversationId, enabled ? "ACTIVE" : "INACTIVE"]
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    if (!enabled) {
      await client.query(
        `UPDATE message_reaction_events
         SET processing_status = 'PROCESSED',
             processing_result = 'CONVERSATION_READING_DISABLED',
             processed_at = NOW()
         WHERE channel_connection_id = $1
           AND external_chat_id = $2
           AND processing_status = 'PENDING'`,
        [result.rows[0].channel_connection_id, result.rows[0].external_chat_id]
      );

      await client.query(
        `DELETE FROM conversation_outbox
         WHERE published_at IS NULL
           AND payload->>'conversationId' = $1`,
        [String(conversationId)]
      );

      const cancelledSlas = await client.query(
        `UPDATE sla_trackings
         SET status = 'CANCELLED',
             next_reminder_at = NULL,
             updated_at = NOW()
         WHERE conversation_id = $1
           AND status = 'WAITING'
         RETURNING id`,
        [conversationId]
      );

      if (cancelledSlas.rowCount > 0) {
        await client.query(
          `UPDATE reminder_jobs
           SET status = 'CANCELLED',
               completed_at = NOW(),
               claimed_at = NULL
           WHERE sla_id = ANY($1::bigint[])
             AND status IN ('PENDING', 'PROCESSING')`,
          [cancelledSlas.rows.map(sla => sla.id)]
        );
      }
    }

    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  saveMessage,
  updateConversationStatus,
  isReadingEnabled,
  listConversations,
  setReadingEnabled,
  setMonitoredGroupStatus
};
