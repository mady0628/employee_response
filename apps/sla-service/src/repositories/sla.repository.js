const pool = require("../config/database");
const { addSupportMinutes, supportMinutesBetween } = require("../../../../shared/support-hours");

async function getPolicy(client = pool) {
  const result = await client.query(
    `SELECT first_response_minutes, reminder_interval_minutes,
            new_sla_gap_minutes, updated_at
     FROM sla_policy_settings
     WHERE id = 1`
  );
  return result.rows[0] || {
    first_response_minutes: 10,
    reminder_interval_minutes: 10,
    new_sla_gap_minutes: 5
  };
}

async function updatePolicy({ firstResponseMinutes, reminderIntervalMinutes, newSlaGapMinutes }) {
  const result = await pool.query(
    `INSERT INTO sla_policy_settings (
       id, first_response_minutes, reminder_interval_minutes,
       new_sla_gap_minutes, updated_at
     ) VALUES (1, $1, $2, $3, NOW())
     ON CONFLICT (id) DO UPDATE SET
       first_response_minutes = EXCLUDED.first_response_minutes,
       reminder_interval_minutes = EXCLUDED.reminder_interval_minutes,
       new_sla_gap_minutes = EXCLUDED.new_sla_gap_minutes,
       updated_at = NOW()
     RETURNING first_response_minutes, reminder_interval_minutes,
               new_sla_gap_minutes, updated_at`,
    [firstResponseMinutes, reminderIntervalMinutes, newSlaGapMinutes]
  );
  await rescheduleWaitingSlas();
  return result.rows[0];
}

async function rescheduleWaitingSlas() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const policy = await getPolicy(client);
    const waiting = await client.query(
      `SELECT id, waiting_started_at, reminder_count
       FROM sla_trackings
       WHERE status = 'WAITING'
       FOR UPDATE`
    );

    for (const sla of waiting.rows) {
      const firstDeadline = addSupportMinutes(sla.waiting_started_at, policy.first_response_minutes);
      const nextReminder = addSupportMinutes(
        sla.waiting_started_at,
        policy.first_response_minutes + Number(sla.reminder_count) * policy.reminder_interval_minutes
      );
      if (!firstDeadline || !nextReminder) throw new Error(`Could not calculate support-time deadline for SLA ${sla.id}`);

      await client.query(
        `UPDATE sla_trackings
         SET first_deadline_at = $1,
             next_reminder_at = $2,
             updated_at = NOW()
         WHERE id = $3 AND status = 'WAITING'`,
        [firstDeadline, nextReminder, sla.id]
      );

      const pendingJobs = await client.query(
        `SELECT id, reminder_number
         FROM reminder_jobs
         WHERE sla_id = $1 AND status = 'PENDING'`,
        [sla.id]
      );
      for (const job of pendingJobs.rows) {
        const scheduledAt = addSupportMinutes(
          sla.waiting_started_at,
          policy.first_response_minutes + (Number(job.reminder_number) - 1) * policy.reminder_interval_minutes
        );
        if (!scheduledAt) throw new Error(`Could not calculate support-time reminder for SLA ${sla.id}`);
        await client.query(
          `UPDATE reminder_jobs SET scheduled_at = $1 WHERE id = $2 AND status = 'PENDING'`,
          [scheduledAt, job.id]
        );
      }
    }
    await client.query("COMMIT");
    return waiting.rowCount;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getDashboardOverview(days = 7) {
  const result = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'WAITING')::integer AS waiting,
       COUNT(*) FILTER (
         WHERE status = 'WAITING' AND first_deadline_at < NOW()
       )::integer AS overdue,
       COUNT(*) FILTER (
         WHERE status = 'RESPONDED'
           AND responded_at >= date_trunc('day', NOW())
       )::integer AS responded_today,
       COUNT(*) FILTER (
         WHERE status = 'RESPONDED'
           AND waiting_started_at >= NOW() - ($1::integer * INTERVAL '1 day')
       )::integer AS responded_in_period,
       ROUND(AVG(EXTRACT(EPOCH FROM (responded_at - waiting_started_at)) / 60.0)
         FILTER (WHERE status = 'RESPONDED'
           AND waiting_started_at >= NOW() - ($1::integer * INTERVAL '1 day'))::numeric, 1)
         AS avg_response_minutes,
       ROUND(100.0 * COUNT(*) FILTER (
         WHERE status = 'RESPONDED'
           AND responded_at <= first_deadline_at
           AND waiting_started_at >= NOW() - ($1::integer * INTERVAL '1 day')
       ) / NULLIF(COUNT(*) FILTER (
         WHERE status = 'RESPONDED'
           AND waiting_started_at >= NOW() - ($1::integer * INTERVAL '1 day')
       ), 0), 1) AS compliance_percent
     FROM sla_trackings`,
    [days]
  );
  return result.rows[0];
}

async function listAdminSlas({ status = "ALL", platform = "ALL", limit = 100 }) {
  const result = await pool.query(
    `SELECT s.id, s.status, s.customer_platform_id, s.waiting_started_at,
            s.first_deadline_at, s.responded_at, s.response_method,
            s.reminder_count, s.requires_explicit_reply,
            c.platform, c.title AS group_name, c.external_chat_id,
            m.content AS customer_message,
            e.full_name AS response_employee
     FROM sla_trackings s
     JOIN conversations c ON c.id = s.conversation_id
     LEFT JOIN messages m ON m.id = s.first_message_id
     LEFT JOIN employees e ON e.id = s.response_employee_id
     WHERE ($1::varchar = 'ALL' OR s.status = $1)
       AND ($2::varchar = 'ALL' OR c.platform = $2)
     ORDER BY CASE WHEN s.status = 'WAITING' THEN 0 ELSE 1 END,
              COALESCE(s.responded_at, s.waiting_started_at) DESC
     LIMIT $3`,
    [status, platform, limit]
  );
  const now = new Date();
  return result.rows.map(row => ({
    ...row,
    sla_elapsed_minutes: row.status === "WAITING"
      ? supportMinutesBetween(row.waiting_started_at, now)
      : null
  }));
}

async function getDailyReport(days = 14) {
  const result = await pool.query(
    `WITH dates AS (
       SELECT generate_series(
         date_trunc('day', NOW()) - (($1::integer - 1) * INTERVAL '1 day'),
         date_trunc('day', NOW()), INTERVAL '1 day'
       ) AS day
     ), daily AS (
       SELECT date_trunc('day', waiting_started_at) AS day,
              COUNT(*)::integer AS opened,
              COUNT(*) FILTER (WHERE status = 'RESPONDED')::integer AS responded,
              COUNT(*) FILTER (WHERE status = 'WAITING')::integer AS waiting,
              COUNT(*) FILTER (WHERE status = 'RESPONDED'
                AND responded_at <= first_deadline_at)::integer AS within_sla,
              AVG(EXTRACT(EPOCH FROM (responded_at - waiting_started_at)) / 60.0)
                FILTER (WHERE status = 'RESPONDED') AS avg_response_minutes
       FROM sla_trackings
       WHERE waiting_started_at >= date_trunc('day', NOW()) - (($1::integer - 1) * INTERVAL '1 day')
       GROUP BY 1
     )
     SELECT dates.day,
            COALESCE(daily.opened, 0)::integer AS opened,
            COALESCE(daily.responded, 0)::integer AS responded,
            COALESCE(daily.waiting, 0)::integer AS waiting,
            COALESCE(daily.within_sla, 0)::integer AS within_sla,
            ROUND(daily.avg_response_minutes::numeric, 1) AS avg_response_minutes
     FROM dates LEFT JOIN daily USING (day)
     ORDER BY dates.day`,
    [days]
  );
  return result.rows;
}

async function getResponseTimeReportRows({ fromStart, toEndExclusive, platform, groupId }) {
  const result = await pool.query(
    `SELECT s.id, s.status, s.waiting_started_at, s.responded_at,
            s.response_method, c.id::text AS conversation_id,
            c.platform, c.title AS group_name, c.external_chat_id
     FROM sla_trackings s
     JOIN conversations c ON c.id = s.conversation_id
     WHERE s.waiting_started_at >= $1::timestamptz
       AND s.waiting_started_at < $2::timestamptz
       AND ($3::varchar = 'ALL' OR c.platform = $3)
       AND (
         $4::bigint IS NULL OR EXISTS (
           SELECT 1
           FROM monitored_groups mg
           WHERE mg.id = $4
             AND mg.channel_connection_id = c.channel_connection_id
             AND mg.external_group_id = c.external_chat_id
         )
       )
     ORDER BY s.waiting_started_at, s.id`,
    [fromStart, toEndExclusive, platform, groupId]
  );
  return result.rows;
}

async function findWaitingSlas(client, conversationId) {
  const result = await client.query(
    `SELECT s.* FROM sla_trackings s
     WHERE s.conversation_id = $1 AND s.status = 'WAITING'
     ORDER BY s.waiting_started_at, s.id
     FOR UPDATE`,
    [conversationId]
  );

  return result.rows;
}

async function createSla(client, event, requiresReply) {
  const policy = await getPolicy(client);
  const firstDeadline = addSupportMinutes(event.sentAt, policy.first_response_minutes);
  if (!firstDeadline) throw new Error("Could not calculate first response deadline");
  const result = await client.query(
    `INSERT INTO sla_trackings (
       conversation_id,
       customer_platform_id,
       first_message_id,
       waiting_started_at,
       first_deadline_at,
       next_reminder_at,
       requires_explicit_reply
     )
     VALUES (
       $1,
       $2,
       $3,
       $4::timestamptz,
       $5::timestamptz,
       $5::timestamptz,
       $6
     )
     RETURNING *`,
    [
      event.conversationId,
      event.senderPlatformId,
      event.messageId,
      event.sentAt,
      firstDeadline,
      requiresReply
    ]
  );

  return result.rows[0];
}

async function linkMessage(client, slaId, messageId) {
  await client.query(
    `INSERT INTO sla_message_links (sla_id, message_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [slaId, messageId]
  );
}

async function requireReply(client, slaIds) {
  if (slaIds.length === 0) return;

  await client.query(
    `UPDATE sla_trackings
     SET requires_explicit_reply = TRUE,
         updated_at = NOW()
     WHERE id = ANY($1::bigint[])
       AND status = 'WAITING'`,
    [slaIds]
  );
}

async function findWaitingSlaByReply(
  client,
  conversationId,
  originalPlatformMessageId
) {
  const result = await client.query(
    `SELECT s.*
     FROM sla_trackings s
     JOIN sla_message_links sml ON sml.sla_id = s.id
     JOIN messages m ON m.id = sml.message_id
     WHERE s.conversation_id = $1
       AND s.status = 'WAITING'
       AND m.platform_message_id = $2
     FOR UPDATE OF s`,
    [conversationId, originalPlatformMessageId]
  );

  return result.rows[0] || null;
}

async function cancelPendingReminders(client, slaId) {
  const result = await client.query(
    `UPDATE reminder_jobs
     SET status = 'CANCELLED',
         completed_at = NOW()
     WHERE sla_id = $1
       AND status = 'PENDING'
     RETURNING id, reminder_number`,
    [slaId]
  );

  return result.rows;
}

async function closeSla(client, slaId, event, method) {
  const result = await client.query(
    `UPDATE sla_trackings
     SET status = 'RESPONDED',
         responded_at = $2::timestamptz,
         response_employee_id = $3,
         response_message_id = $4,
         response_method = $5,
         next_reminder_at = NULL,
         updated_at = NOW()
     WHERE id = $1
       AND status = 'WAITING'
     RETURNING *`,
    [
      slaId,
      event.sentAt,
      event.employeeId,
      event.messageId,
      method
    ]
  );

  const closedSla = result.rows[0];

  if (!closedSla) {
    return null;
  }

  // Hủy các lịch nhắc chưa bắt đầu.
  await cancelPendingReminders(client, slaId);

  return closedSla;
}

module.exports = {
  pool,
  getPolicy,
  updatePolicy,
  rescheduleWaitingSlas,
  getDashboardOverview,
  listAdminSlas,
  getDailyReport,
  getResponseTimeReportRows,
  findWaitingSlas,
  createSla,
  linkMessage,
  requireReply,
  findWaitingSlaByReply,
  closeSla,
  cancelPendingReminders
};
