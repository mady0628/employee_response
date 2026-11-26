const pool = require("../config/database");
const sanitizeErrorMessage = require("../../../../shared/sanitize-error-message");
const { isWithinSupportHours } = require("../../../../shared/support-hours");

async function claimNextJob() {
  if (!isWithinSupportHours()) return null;
  const result = await pool.query(
    `WITH next_job AS (
       SELECT j.id
       FROM reminder_jobs j

       JOIN sla_trackings s
         ON s.id = j.sla_id

       JOIN conversations c
         ON c.id = s.conversation_id

       LEFT JOIN sla_conversation_processing tcp
         ON tcp.conversation_id = c.id
        AND c.platform = 'TELEGRAM'

       LEFT JOIN lark_sla_processing lcp
         ON lcp.conversation_id = c.id
        AND c.platform = 'LARK'

       LEFT JOIN whatsapp_sla_processing wcp
         ON wcp.conversation_id = c.id
        AND c.platform = 'WHATSAPP'

       WHERE j.status = 'PENDING'
         AND j.scheduled_at <= NOW()
         AND j.available_at <= NOW()

         AND s.status = 'WAITING'
         AND c.status = 'ACTIVE'

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

       ORDER BY j.scheduled_at, j.id

       LIMIT 1
       FOR UPDATE OF j SKIP LOCKED
     )

     UPDATE reminder_jobs j
     SET status = 'PROCESSING',
         claimed_at = NOW(),
         attempts = attempts + 1,
         last_error = NULL

     FROM next_job

     WHERE j.id = next_job.id

     RETURNING j.*`
  );

  return result.rows[0] || null;
}

async function deferJobUntil(jobId, availableAt) {
  const result = await pool.query(
    `UPDATE reminder_jobs
     SET status = 'PENDING',
         claimed_at = NULL,
         attempts = GREATEST(attempts - 1, 0),
         available_at = $2::timestamptz,
         last_error = NULL
     WHERE id = $1 AND status = 'PROCESSING'
     RETURNING id`,
    [jobId, availableAt]
  );
  return result.rowCount > 0;
}

async function getJobContext(jobId) {
  const result = await pool.query(
    `SELECT
       j.id AS job_id,
       j.reminder_number,
       j.status AS job_status,
       j.attempts,
       s.id AS sla_id,
       s.status AS sla_status,
       s.customer_platform_id,
       s.waiting_started_at,
       m.sender_display_name,
       m.sender_username,
       m.sender_platform_id AS message_sender_platform_id,
       m.content AS customer_message_content,
       m.message_type AS customer_message_type,
       c.title AS group_title,
       c.external_chat_id,
       c.channel_connection_id,
       c.platform,
       c.status AS conversation_status
     FROM reminder_jobs j
     JOIN sla_trackings s ON s.id = j.sla_id
     JOIN conversations c ON c.id = s.conversation_id
     LEFT JOIN messages m ON m.id = s.first_message_id
     WHERE j.id = $1`,
    [jobId]
  );

  return result.rows[0] || null;
}

async function isSlaWaiting(slaId) {
  const result = await pool.query(
    `SELECT 1
     FROM sla_trackings s
     JOIN conversations c ON c.id = s.conversation_id
     LEFT JOIN sla_conversation_processing tcp ON tcp.conversation_id = c.id AND c.platform = 'TELEGRAM'
     LEFT JOIN lark_sla_processing lcp ON lcp.conversation_id = c.id AND c.platform = 'LARK'
     LEFT JOIN whatsapp_sla_processing wcp ON wcp.conversation_id = c.id AND c.platform = 'WHATSAPP'
     WHERE s.id = $1
       AND s.status = 'WAITING'
       AND c.status = 'ACTIVE'
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
       )`,
    [slaId]
  );

  return result.rowCount > 0;
}

async function getDelivery(jobId, employeeId) {
  const result = await pool.query(
    `SELECT *
     FROM reminder_deliveries
     WHERE reminder_job_id = $1
       AND employee_id = $2`,
    [jobId, employeeId]
  );

  return result.rows[0] || null;
}

async function saveDelivery({
  jobId,
  employeeId,
  telegramUserId,
  status,
  errorMessage = null
}) {
  await pool.query(
    `INSERT INTO reminder_deliveries (
       reminder_job_id,
       employee_id,
       platform,
       platform_user_id,
       telegram_user_id,
       status,
       error_message,
       sent_at
     )
     VALUES (
       $1, $2, 'TELEGRAM', $3, $3, $4::VARCHAR, $5,
       CASE WHEN $4::VARCHAR = 'SENT' THEN NOW() ELSE NULL END
     )
     ON CONFLICT (reminder_job_id, employee_id)
     DO UPDATE SET
       status = EXCLUDED.status,
       error_message = EXCLUDED.error_message,
       sent_at = CASE
         WHEN EXCLUDED.status = 'SENT' THEN NOW()
         ELSE reminder_deliveries.sent_at
       END
     WHERE reminder_deliveries.status <> 'SENT'`,
    [
      jobId,
      employeeId,
      telegramUserId,
      status,
      sanitizeErrorMessage(errorMessage, 500)
    ]
  );
}

async function saveLarkDelivery({
  jobId,
  employeeId,
  openId,
  status,
  errorMessage = null
}) {
  await pool.query(
    `INSERT INTO reminder_deliveries (
       reminder_job_id,
       employee_id,
       platform,
       platform_user_id,
       status,
       error_message,
       sent_at
     )
     VALUES (
       $1, $2, 'LARK', $3, $4::VARCHAR, $5,
       CASE
         WHEN $4::VARCHAR = 'SENT' THEN NOW()
         ELSE NULL
       END
     )

     ON CONFLICT (
       reminder_job_id,
       employee_id
     )

     DO UPDATE SET
       status = EXCLUDED.status,
       error_message = EXCLUDED.error_message,
       sent_at = CASE
         WHEN EXCLUDED.status = 'SENT'
         THEN NOW()
         ELSE reminder_deliveries.sent_at
       END

     WHERE reminder_deliveries.status <> 'SENT'`,
    [
      jobId,
      employeeId,
      openId,
      status,
      sanitizeErrorMessage(errorMessage, 500)
    ]
  );
}

async function completeJob(jobId) {
  await pool.query(
    `UPDATE reminder_jobs
     SET status = 'COMPLETED',
         completed_at = NOW(),
         claimed_at = NULL
     WHERE id = $1
       AND status = 'PROCESSING'`,
    [jobId]
  );
}

async function cancelJob(jobId) {
  await pool.query(
    `UPDATE reminder_jobs
     SET status = 'CANCELLED',
         completed_at = NOW(),
         claimed_at = NULL
     WHERE id = $1
       AND status = 'PROCESSING'`,
    [jobId]
  );
}

async function failJob(jobId, errorMessage) {
  await pool.query(
    `UPDATE reminder_jobs
     SET status = CASE
           WHEN attempts >= 3 THEN 'FAILED'
           ELSE 'PENDING'
         END,
         available_at = NOW() + (LEAST(attempts, 3) * INTERVAL '30 seconds'),
         claimed_at = NULL,
         last_error = $2
     WHERE id = $1
       AND status = 'PROCESSING'`,
    [jobId, sanitizeErrorMessage(errorMessage)]
  );
}

async function recoverStaleJobs() {
  await pool.query(
    `UPDATE reminder_jobs
     SET status = CASE
           WHEN attempts >= 3 THEN 'FAILED'
           ELSE 'PENDING'
         END,
         claimed_at = NULL,
         available_at = NOW()
     WHERE status = 'PROCESSING'
       AND claimed_at < NOW() - INTERVAL '2 minutes'`
  );
}

async function cleanupCancelledJobs() {
  const result = await pool.query(
    `UPDATE reminder_jobs j

     SET status = 'CANCELLED',
         completed_at = NOW()

     FROM sla_trackings s
     JOIN conversations c
       ON c.id = s.conversation_id

     WHERE j.sla_id = s.id
       AND j.status = 'PENDING'
       AND (
         s.status <> 'WAITING'
         OR c.status <> 'ACTIVE'
       )

     RETURNING j.id`
  );

  return result.rowCount;
}

async function saveWhatsAppDelivery({
  jobId,
  employeeId,
  platformUserId,
  status,
  externalMessageId = null,
  errorMessage = null
}) {
  const result = await pool.query(
    `INSERT INTO reminder_deliveries (
       reminder_job_id,
       employee_id,
       platform,
       platform_user_id,
       status,
       external_message_id,
       error_message,
       sent_at
     )
     VALUES (
       $1, $2, 'WHATSAPP', $3,
       $4::VARCHAR, $5, $6,
       CASE
         WHEN $4::VARCHAR = 'SENT' THEN NOW()
         ELSE NULL
       END
     )
     ON CONFLICT (
       reminder_job_id,
       employee_id
     )
     DO UPDATE SET
       status = EXCLUDED.status,
       platform_user_id = EXCLUDED.platform_user_id,
       external_message_id = EXCLUDED.external_message_id,
       error_message = EXCLUDED.error_message,
       sent_at = EXCLUDED.sent_at
     WHERE reminder_deliveries.status <> 'SENT'
     RETURNING id, status`,
    [
      jobId,
      employeeId,
      platformUserId,
      status,
      externalMessageId,
      sanitizeErrorMessage(errorMessage, 500)
    ]
  );

  return result.rows[0] || null;
}

module.exports = {
  claimNextJob,
  deferJobUntil,
  getJobContext,
  isSlaWaiting,
  getDelivery,
  saveDelivery,
  saveLarkDelivery,
  saveWhatsAppDelivery,
  completeJob,
  cancelJob,
  failJob,
  recoverStaleJobs,
  cleanupCancelledJobs
};
