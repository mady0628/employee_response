const pool = require("../config/database");

const {
  processReaction
} = require("../services/reaction.service");

const REACTION_BUFFER_SECONDS = Number(process.env.REACTION_BUFFER_SECONDS || 15);

async function runReactionWorker() {
  // Chỉ nhận reaction đã được lưu ít nhất REACTION_BUFFER_SECONDS,
  // tạo thời gian đệm cho tin nhắn gốc.
  const result = await pool.query(
    `SELECT *
     FROM message_reaction_events
     WHERE processing_status = 'PENDING'
       AND received_at <= NOW() - ($1::integer * INTERVAL '1 second')
     ORDER BY id
     LIMIT 20`,
    [REACTION_BUFFER_SECONDS]
  );

  for (const reaction of result.rows) {
    try {
      const outcome = await processReaction(reaction);

      console.log("Reaction processed:", {
        id: reaction.id,
        result: outcome
      });
    } catch (error) {
      console.error(
        "Reaction processing failed:",
        reaction.id,
        error.message
      );
    }
  }
}

function startReactionWorker() {
  let running = false;

  const timer = setInterval(async () => {
    if (running) return;

    running = true;

    try {
      await runReactionWorker();
    } finally {
      running = false;
    }
  }, 3000);

  console.log("Reaction Worker started");

  return timer;
}

module.exports = {
  startReactionWorker,
  runReactionWorker
};
