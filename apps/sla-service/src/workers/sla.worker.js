const pool = require("../config/database");

const slaRepository = require("../repositories/sla.repository");
const { addSupportMinutes, isWithinSupportHours } = require("../../../../shared/support-hours");

async function createDueReminderJobs(now = new Date()) {
  if (!isWithinSupportHours(now)) return 0;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const policy = await slaRepository.getPolicy(client);

    const result = await client.query(
      `SELECT
         s.id,
         s.reminder_count,
         s.next_reminder_at,
         s.waiting_started_at
       FROM sla_trackings s

       JOIN conversations c
         ON c.id = s.conversation_id

       LEFT JOIN sla_conversation_processing tcp
         ON tcp.conversation_id = s.conversation_id
        AND c.platform = 'TELEGRAM'

       LEFT JOIN lark_sla_processing lcp
         ON lcp.conversation_id = s.conversation_id
        AND c.platform = 'LARK'

       LEFT JOIN whatsapp_sla_processing wcp
         ON wcp.conversation_id = s.conversation_id
        AND c.platform = 'WHATSAPP'

       WHERE s.status = 'WAITING'
         AND c.status = 'ACTIVE'
         AND s.next_reminder_at <= NOW()
         AND (c.platform <> 'WHATSAPP' OR $1::boolean = TRUE)

         AND (
           (
             c.platform = 'TELEGRAM'
             AND tcp.conversation_id IS NOT NULL
             AND tcp.requires_review = FALSE
           )
           OR
           (
             c.platform = 'LARK'
             AND lcp.conversation_id IS NOT NULL
             AND lcp.requires_review = FALSE
           )
           OR
           (
             c.platform = 'WHATSAPP'
             AND wcp.conversation_id IS NOT NULL
             AND wcp.requires_review = FALSE
             AND c.external_chat_id ~ '^[0-9]+@g\\.us$'
           )
         )

       ORDER BY s.next_reminder_at, s.id
       LIMIT 50
       FOR UPDATE OF s SKIP LOCKED`,
      [process.env.WA_REMINDER_ENABLED === "true"]
    );

    for (const sla of result.rows) {
      const reminderNumber = sla.reminder_count + 1;
      const cadenceDeadline = addSupportMinutes(
        sla.waiting_started_at,
        policy.first_response_minutes + reminderNumber * policy.reminder_interval_minutes
      );
      const nextFromNow = addSupportMinutes(now, policy.reminder_interval_minutes);
      if (!cadenceDeadline || !nextFromNow) throw new Error(`Could not calculate next reminder for SLA ${sla.id}`);
      const nextReminderAt = new Date(Math.max(cadenceDeadline.getTime(), nextFromNow.getTime()));

      await client.query(
        `INSERT INTO reminder_jobs (
           sla_id,
           reminder_number,
           scheduled_at
         )
         VALUES ($1, $2, $3)
         ON CONFLICT (sla_id, reminder_number)
         DO NOTHING`,
        [
          sla.id,
          reminderNumber,
          sla.next_reminder_at
        ]
      );

      // Advance on support time and avoid bursts after service downtime.
      await client.query(
        `UPDATE sla_trackings
         SET reminder_count = $1,
             next_reminder_at = $2,
             updated_at = NOW()
         WHERE id = $4
           AND status = 'WAITING'`,
        [
          reminderNumber,
          nextReminderAt,
          sla.id
        ]
      );
    }

    await client.query("COMMIT");

    return result.rowCount;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function startSlaWorker() {
  console.log("SLA Worker started");

  let running = false;

  const timer = setInterval(async () => {
    if (running) return;

    running = true;

    try {
      const count = await createDueReminderJobs();

      if (count > 0) {
        console.log(`Created reminder jobs: ${count}`);
      }
    } catch (error) {
      console.error("SLA Worker failed:", error.message);
    } finally {
      running = false;
    }
  }, 5000);

  return timer;
}

module.exports = {
  createDueReminderJobs,
  startSlaWorker
};
