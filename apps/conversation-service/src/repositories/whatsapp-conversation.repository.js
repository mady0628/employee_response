const pool = require("../config/database");

async function saveWhatsAppMessage({ event, senderType, employeeId }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const connection = await client.query(
      `SELECT id FROM channel_connections WHERE id = $1 AND platform = 'WHATSAPP' AND status = 'ACTIVE'`,
      [event.connectionId]
    );
    if (!connection.rowCount) {
      throw new Error("WhatsApp connection inactive or missing");
    }

    const monitoredGroup = await client.query(
      `SELECT status, monitoring_started_at
       FROM monitored_groups
       WHERE channel_connection_id = $1 AND external_group_id = $2`,
      [event.connectionId, event.conversation.externalId]
    );
    if (monitoredGroup.rowCount && monitoredGroup.rows[0].status !== "ACTIVE") {
      await client.query("COMMIT");
      return { ignored: true, reason: "MONITORED_GROUP_DISABLED" };
    }

    const startAt = new Date(monitoredGroup.rows[0]?.monitoring_started_at || event.monitoringStartedAt);
    const sentAt = new Date(event.message.sentAt);
    if (
      !Number.isFinite(startAt.getTime()) ||
      !Number.isFinite(sentAt.getTime())
    ) {
      throw new Error("Invalid monitoring timestamp");
    }

    if (sentAt < startAt) {
      await client.query("COMMIT");
      return { ignored: true, reason: "BEFORE_MONITORING_START" };
    }

    const conversation = await client.query(
      `INSERT INTO conversations (
        channel_connection_id,
        platform,
        external_chat_id,
        title,
        chat_type,
        status,
        monitoring_started_at
      ) VALUES (
        $1, 'WHATSAPP', $2, $3, 'GROUP', 'ACTIVE', $4
      ) ON CONFLICT (
        channel_connection_id, external_chat_id
      ) DO UPDATE SET
        title = COALESCE(EXCLUDED.title, conversations.title)
      RETURNING id, monitoring_started_at`,
      [
        event.connectionId,
        event.conversation.externalId,
        event.conversation.title,
        event.monitoringStartedAt
      ]
    );

    const conversationId = conversation.rows[0].id;

    // Không chấp nhận sự kiện trước mốc đã ghi trong database.
    if (
      sentAt < new Date(conversation.rows[0].monitoring_started_at)
    ) {
      await client.query("COMMIT");
      return { ignored: true, reason: "BEFORE_MONITORING_START" };
    }

    const finalSenderType = senderType;

    const result = await client.query(
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
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      ) ON CONFLICT (
        conversation_id, platform_message_id
      ) DO NOTHING
      RETURNING id`,
      [
        conversationId,
        event.message.externalId,
        event.sender.externalId,
        event.sender.displayName || null,
        event.sender.username || null,
        finalSenderType,
        employeeId,
        event.message.replyToExternalMessageId,
        event.message.type || "TEXT",
        event.message.content,
        event.message.sentAt
      ]
    );

    if (result.rowCount > 0 && finalSenderType !== "UNKNOWN") {
      const messageId = String(result.rows[0].id);

      const slaEvent = {
        eventId: `whatsapp-message:${messageId}`,
        eventType: "conversation.message.saved",
        schemaVersion: 1,

        platform: "WHATSAPP",
        conversationId: String(conversationId),
        messageId,

        platformMessageId: event.message.externalId,

        senderPlatformId: event.sender.externalId,
        senderType: finalSenderType,
        employeeId: employeeId ? String(employeeId) : null,

        replyToPlatformMessageId:
          event.message.replyToExternalMessageId || null,

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
      inserted: result.rowCount > 0,
      messageId: result.rows[0]?.id ? String(result.rows[0].id) : null,
      senderType: finalSenderType,
      slaEligible: finalSenderType !== "UNKNOWN"
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { saveWhatsAppMessage };
