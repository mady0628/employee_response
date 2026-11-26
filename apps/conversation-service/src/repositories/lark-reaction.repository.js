const pool = require("../config/database");

async function saveLarkReaction(event) {
  const result = await pool.query(
    `INSERT INTO lark_reaction_inbox (
       event_id,
       channel_connection_id,
       target_message_id,
       actor_open_id,
       emoji_type,
       reacted_at
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (event_id) DO NOTHING
     RETURNING id`,
    [
      event.eventId,
      event.connectionId,
      event.targetMessageId,
      event.actorOpenId,
      event.emojiType,
      event.reactedAt
    ]
  );

  return {
    inserted: result.rowCount > 0
  };
}

module.exports = {
  saveLarkReaction
};
