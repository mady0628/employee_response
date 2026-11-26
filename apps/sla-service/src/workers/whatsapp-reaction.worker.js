const pool = require("../config/database");

const {
  processWhatsAppReaction
} = require("../services/whatsapp-reaction.service");

const WAIT_SECONDS = 20;
const REVIEW_AFTER_MINUTES = 10;

async function processPendingReactions(waitSeconds = WAIT_SECONDS) {
  const result = await pool.query(
    `SELECT id
     FROM whatsapp_reaction_inbox
     WHERE status = 'PENDING'
       AND received_at <=
           NOW() - ($1::integer * INTERVAL '1 second')
     ORDER BY received_at, id
     LIMIT 30`,
    [waitSeconds]
  );

  const outcomes = [];
  for (const row of result.rows) {
    try {
      const outcome = await processWhatsAppReaction(
        row.id
      );

      console.log("WhatsApp reaction:", {
        id: row.id,
        outcome
      });
      outcomes.push({ id: row.id, outcome });
    } catch (error) {
      console.error(
        "WhatsApp reaction error:",
        error.message
      );
    }
  }
  return outcomes;
}

// Tránh reaction chờ vô hạn khi không có tin gốc.
async function markStaleReactionsForReview() {
  await pool.query(
    `UPDATE whatsapp_reaction_inbox
     SET status = 'REVIEW',
         processing_result = 'TARGET_OR_SLA_NOT_RESOLVED',
         processed_at = NOW()
     WHERE status = 'PENDING'
       AND received_at <
           NOW() - ($1::integer * INTERVAL '1 minute')`,
    [REVIEW_AFTER_MINUTES]
  );
}

function startWhatsAppReactionWorker() {
  let running = false;

  const timer = setInterval(async () => {
    if (running) return;

    running = true;

    try {
      await processPendingReactions();
      await markStaleReactionsForReview();
    } catch (error) {
      console.error(
        "WhatsApp Reaction Worker:",
        error.message
      );
    } finally {
      running = false;
    }
  }, 3000);

  console.log("WhatsApp Reaction Worker started");

  return timer;
}

module.exports = {
  startWhatsAppReactionWorker,
  processPendingReactions,
  markStaleReactionsForReview
};
