const pool = require("../config/database");

async function saveWhatsAppReaction(event) {
  const result = await pool.query(
    `INSERT INTO whatsapp_reaction_inbox (
       event_id,
       channel_connection_id,
       target_message_id,
       actor_platform_id,
       reaction_type,
       reacted_at
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (event_id) DO NOTHING
     RETURNING id`,
    [
      event.eventId,
      event.connectionId,
      event.targetMessageId,
      event.actorPlatformId,
      event.reactionType,
      event.reactedAt
    ]
  );

  return {
    inserted: result.rowCount > 0
  };
}

module.exports = {
  saveWhatsAppReaction
};
