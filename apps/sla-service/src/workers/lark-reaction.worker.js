const pool = require("../config/database");

const {
  processLarkReaction
} = require("../services/lark-reaction.service");

async function runOnce(customAgeSeconds = 15) {
  const result = await pool.query(
    `SELECT id
     FROM lark_reaction_inbox
     WHERE status = 'PENDING'
       AND received_at <= NOW() - ($1::integer * INTERVAL '1 second')
     ORDER BY id
     LIMIT 20`,
    [customAgeSeconds]
  );

  const outcomes = [];

  for (const row of result.rows) {
    try {
      const outcome = await processLarkReaction(row.id);
      outcomes.push({ id: row.id, outcome });

      if (
        outcome !== "WAITING_FOR_MESSAGE" &&
        outcome !== "WAITING_FOR_SLA_INBOX" &&
        outcome !== "WAITING_FOR_SLA_STATE" &&
        outcome !== "WAITING_FOR_EARLIER_MESSAGES"
      ) {
        console.log("Lark reaction:", {
          reactionId: row.id,
          outcome
        });
      }
    } catch (error) {
      console.error(
        `Lark reaction ${row.id} failed:`,
        error.message
      );
    }
  }

  return outcomes;
}

function startLarkReactionWorker() {
  let running = false;

  const timer = setInterval(async () => {
    if (running) return;

    running = true;

    try {
      await runOnce(15);
    } catch (error) {
      console.error(
        "Lark Reaction Worker failed:",
        error.message
      );
    } finally {
      running = false;
    }
  }, 3000);

  console.log("Lark Reaction Worker started");

  return timer;
}

module.exports = {
  startLarkReactionWorker,
  runOnce
};
