const pool = require("../config/database");

async function processWhatsAppReaction(reactionId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Xác định group thông qua tin gốc.
    // Không cần tin group ID từ reaction event.
    const targetResult = await client.query(
      `SELECT
         m.id AS message_id,
         m.sender_type,
         m.sent_at,
         c.id AS conversation_id,
         c.status AS conversation_status,
         c.monitoring_started_at,
         r.reacted_at,
         r.actor_platform_id

       FROM whatsapp_reaction_inbox r

       JOIN messages m
         ON m.platform_message_id =
            r.target_message_id

       JOIN conversations c
         ON c.id = m.conversation_id
        AND c.channel_connection_id =
            r.channel_connection_id
        AND c.platform = 'WHATSAPP'

       WHERE r.id = $1`,
      [reactionId]
    );

    if (targetResult.rowCount === 0) {
      // Tin gốc có thể chưa được đồng bộ.
      await client.query("COMMIT");
      return "WAITING_FOR_TARGET";
    }

    if (targetResult.rowCount > 1) {
      throw new Error(
        "Ambiguous reaction target message"
      );
    }

    const target = targetResult.rows[0];

    // 2. Khóa trạng thái group trước.
    // Giữ thứ tự khóa giống SLA Inbox Worker.
    const stateResult = await client.query(
      `SELECT *
       FROM whatsapp_sla_processing
       WHERE conversation_id = $1
       FOR UPDATE`,
      [target.conversation_id]
    );

    if (!stateResult.rowCount) {
      await client.query("COMMIT");
      return "WAITING_FOR_SLA_STATE";
    }

    const state = stateResult.rows[0];

    // 3. Khóa reaction.
    const reactionResult = await client.query(
      `SELECT *
       FROM whatsapp_reaction_inbox
       WHERE id = $1
       FOR UPDATE`,
      [reactionId]
    );

    const reaction = reactionResult.rows[0];

    if (reaction.status !== "PENDING") {
      await client.query("COMMIT");
      return "ALREADY_PROCESSED";
    }

    async function finish(
      outcome,
      status = "PROCESSED",
      slaId = null
    ) {
      await client.query(
        `UPDATE whatsapp_reaction_inbox
         SET status = $1,
             processing_result = $2,
             sla_id = $3,
             processed_at = NOW()
         WHERE id = $4`,
        [
          status,
          outcome,
          slaId,
          reactionId
        ]
      );
    }

    async function review(reason, slaId = null) {
      await client.query(
        `UPDATE whatsapp_sla_processing
         SET requires_review = TRUE,
             updated_at = NOW()
         WHERE conversation_id = $1`,
        [target.conversation_id]
      );

      await finish(reason, "REVIEW", slaId);
      await client.query("COMMIT");
      return reason;
    }

    // 4. Kiểm tra group và mốc giám sát.
    if (
      !target.monitoring_started_at ||
      new Date(target.sent_at) <
        new Date(target.monitoring_started_at) ||
      new Date(reaction.reacted_at) <
        new Date(target.monitoring_started_at)
    ) {
      await finish("BEFORE_MONITORING_START");
      await client.query("COMMIT");
      return "BEFORE_MONITORING_START";
    }

    if (target.conversation_status !== "ACTIVE") {
      await finish("CONVERSATION_INACTIVE");
      await client.query("COMMIT");
      return "CONVERSATION_INACTIVE";
    }

    if (state.requires_review) {
      await finish(
        "CONVERSATION_REQUIRES_REVIEW",
        "REVIEW"
      );
      await client.query("COMMIT");
      return "CONVERSATION_REQUIRES_REVIEW";
    }

    // 5. Kiểm tra actor có phải Sales không.
    // Dùng cả tài khoản gốc và WhatsApp aliases.
    const employeeResult = await client.query(
      `SELECT e.id
       FROM employees e
       WHERE e.status = 'ACTIVE'
         AND (
           EXISTS (
             SELECT 1
             FROM employee_channel_accounts a
             WHERE a.employee_id = e.id
               AND a.platform = 'WHATSAPP'
               AND a.platform_user_id = $1
               AND a.status = 'VERIFIED'
           )
           OR EXISTS (
             SELECT 1
             FROM whatsapp_identity_aliases a
             WHERE a.employee_id = e.id
               AND a.platform_user_id = $1
               AND a.status = 'VERIFIED'
           )
         )
       LIMIT 2`,
      [reaction.actor_platform_id]
    );

    if (employeeResult.rowCount > 1) {
      return await review("AMBIGUOUS_EMPLOYEE_ID");
    }

    if (!employeeResult.rowCount) {
      await finish("NOT_VERIFIED_EMPLOYEE");
      await client.query("COMMIT");
      return "NOT_VERIFIED_EMPLOYEE";
    }

    const employeeId = employeeResult.rows[0].id;

    if (target.sender_type !== "CUSTOMER") {
      if (target.sender_type === "UNKNOWN") {
        return await review("TARGET_SENDER_UNKNOWN");
      }

      await finish("TARGET_NOT_CUSTOMER");
      await client.query("COMMIT");
      return "TARGET_NOT_CUSTOMER";
    }

    // 6. Tin gốc phải được SLA Inbox xử lý.
    const inboxResult = await client.query(
      `SELECT status
       FROM whatsapp_sla_inbox
       WHERE conversation_id = $1
         AND platform_message_id = $2`,
      [
        target.conversation_id,
        reaction.target_message_id
      ]
    );

    if (
      !inboxResult.rowCount ||
      inboxResult.rows[0].status === "PENDING"
    ) {
      await client.query("COMMIT");
      return "WAITING_FOR_SLA_INBOX";
    }

    if (inboxResult.rows[0].status !== "PROCESSED") {
      return await review("SOURCE_MESSAGE_NOT_PROCESSED");
    }

    // 7. Đợi các tin trước reaction đã biết nhưng SLA Inbox chưa xử lý.
    const pendingResult = await client.query(
      `SELECT 1
       FROM whatsapp_sla_inbox
       WHERE conversation_id = $1
         AND status = 'PENDING'
         AND message_sent_at <= $2
       LIMIT 1`,
      [target.conversation_id, reaction.reacted_at]
    );

    if (pendingResult.rowCount) {
      await client.query("COMMIT");
      return "WAITING_FOR_PRIOR_MESSAGES";
    }

    // Nếu có tin mới hơn thời điểm reaction đã xử lý, cần rà soát thay vì đóng hồi tố.
    if (
      state.last_sent_at &&
      new Date(reaction.reacted_at) <
        new Date(state.last_sent_at)
    ) {
      return await review("REACTION_ARRIVED_LATE");
    }

    // 8. Tìm SLA thông qua đúng message.
    const slaResult = await client.query(
      `SELECT s.*
       FROM sla_trackings s
       JOIN sla_message_links l
         ON l.sla_id = s.id
       WHERE l.message_id = $1
         AND s.conversation_id = $2
       FOR UPDATE OF s`,
      [
        target.message_id,
        target.conversation_id
      ]
    );

    if (!slaResult.rowCount) {
      return await review("SLA_LINK_MISSING");
    }

    const sla = slaResult.rows[0];

    if (sla.status !== "WAITING") {
      if (
        sla.status === "RESPONDED" &&
        sla.responded_at &&
        new Date(reaction.reacted_at) <
          new Date(sla.responded_at)
      ) {
        return await review(
          "REACTION_BEFORE_RECORDED_RESPONSE",
          sla.id
        );
      }

      await finish(
        "SLA_ALREADY_CLOSED",
        "PROCESSED",
        sla.id
      );
      await client.query("COMMIT");
      return "SLA_ALREADY_CLOSED";
    }

    if (
      new Date(reaction.reacted_at) <
      new Date(sla.waiting_started_at)
    ) {
      return await review(
        "INVALID_REACTION_TIME",
        sla.id
      );
    }

    // 9. Đóng SLA.
    await client.query(
      `UPDATE sla_trackings
       SET status = 'RESPONDED',
           responded_at = $2,
           response_employee_id = $3,
           response_message_id = NULL,
           response_method = 'REACTION',
           next_reminder_at = NULL,
           updated_at = NOW()
       WHERE id = $1
         AND status = 'WAITING'`,
      [
        sla.id,
        reaction.reacted_at,
        employeeId
      ]
    );

    // 10. Hủy Reminder Job chưa xử lý.
    await client.query(
      `UPDATE reminder_jobs
       SET status = 'CANCELLED',
           completed_at = NOW()
       WHERE sla_id = $1
         AND status = 'PENDING'`,
      [sla.id]
    );

    await finish(
      "SLA_CLOSED",
      "PROCESSED",
      sla.id
    );

    await client.query("COMMIT");

    return "SLA_CLOSED";
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  processWhatsAppReaction
};
