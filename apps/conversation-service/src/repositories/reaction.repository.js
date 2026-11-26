const pool = require("../config/database");

async function saveReactionEvent(event) {
  const result = await pool.query(
    `INSERT INTO message_reaction_events (
       event_id,
       channel_connection_id,
       external_chat_id,
       target_message_id,
       actor_platform_id,
       reaction_type,
       reacted_at
     )
     SELECT $1::VARCHAR(255),
            $2::BIGINT,
            $3::VARCHAR(255),
            $4::VARCHAR(255),
            $5::VARCHAR(255),
            $6::VARCHAR(30),
            $7::TIMESTAMPTZ
     WHERE NOT EXISTS (
       SELECT 1
       FROM conversations
       WHERE channel_connection_id = $2::BIGINT
         AND external_chat_id = $3::VARCHAR(255)
         AND status = 'INACTIVE'
     )
     ON CONFLICT (event_id) DO NOTHING
     RETURNING id`,
    [
      event.eventId,
      event.connectionId,
      event.conversation.externalId,
      event.targetMessage.externalId,
      event.actor.externalId,
      event.reaction.type,
      event.reactedAt
    ]
  );

  return {
    inserted: result.rowCount > 0
  };
}

module.exports = {
  saveReactionEvent
};
