const pool = require("../config/database");

async function processLarkReaction(reactionId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Khóa reaction để không xử lý đồng thời.
    const reactionResult = await client.query(
      `SELECT * FROM lark_reaction_inbox WHERE id = $1 FOR UPDATE`,
      [reactionId]
    );

    if (!reactionResult.rowCount) {
      await client.query("COMMIT");
      return "NOT_FOUND";
    }

    const reaction = reactionResult.rows[0];

    if (reaction.status !== "PENDING") {
      await client.query("COMMIT");
      return "ALREADY_PROCESSED";
    }

    async function finish(
      result,
      status = "PROCESSED",
      slaId = null
    ) {
      await client.query(
        `UPDATE lark_reaction_inbox
         SET status = $1,
             processing_result = $2,
             sla_id = $3,
             processed_at = NOW()
         WHERE id = $4`,
        [status, result, slaId, reaction.id]
      );
    }

    // 2. Xác định message và conversation.
    const targetResult = await client.query(
      `SELECT
         m.id AS message_id,
         m.sender_type,
         m.sent_at,
         c.id AS conversation_id,
         c.status AS conversation_status
       FROM messages m
       JOIN conversations c
         ON c.id = m.conversation_id
       WHERE c.platform = 'LARK'
         AND c.channel_connection_id = $1
         AND m.platform_message_id = $2`,
      [
        reaction.channel_connection_id,
        reaction.target_message_id
      ]
    );

    if (!targetResult.rowCount) {
      // Tin gốc có thể chưa được Conversation lưu.
      await client.query("COMMIT");
      return "WAITING_FOR_MESSAGE";
    }

    const target = targetResult.rows[0];

    // 3. Khóa trạng thái thứ tự xử lý của group.
    const stateResult = await client.query(
      `SELECT *
       FROM lark_sla_processing
       WHERE conversation_id = $1
       FOR UPDATE`,
      [target.conversation_id]
    );

    if (!stateResult.rowCount) {
      await client.query("COMMIT");
      return "WAITING_FOR_SLA_STATE";
    }

    const state = stateResult.rows[0];

    if (state.requires_review) {
      await finish("CONVERSATION_REQUIRES_REVIEW", "REVIEW");
      await client.query("COMMIT");
      return "CONVERSATION_REQUIRES_REVIEW";
    }

    if (target.conversation_status !== "ACTIVE") {
      await finish("CONVERSATION_INACTIVE");
      await client.query("COMMIT");
      return "CONVERSATION_INACTIVE";
    }

    // 4. Nhận diện Sales bằng mapping đã xác thực.
    const employeeResult = await client.query(
      `SELECT e.id
       FROM employees e
       JOIN employee_channel_accounts a
         ON a.employee_id = e.id
       WHERE e.status = 'ACTIVE'
         AND a.status = 'VERIFIED'
         AND a.platform = 'LARK'
         AND a.platform_user_id = $1`,
      [reaction.actor_open_id]
    );

    if (!employeeResult.rowCount) {
      await finish("NOT_VERIFIED_EMPLOYEE");
      await client.query("COMMIT");
      return "NOT_VERIFIED_EMPLOYEE";
    }

    const employeeId = employeeResult.rows[0].id;

    // 5. Tin được reaction phải là tin Customer.
    if (target.sender_type !== "CUSTOMER") {
      await finish("TARGET_NOT_CUSTOMER");
      await client.query("COMMIT");
      return "TARGET_NOT_CUSTOMER";
    }

    // 6. Tin gốc phải được xử lý qua SLA Inbox.
    const inboxResult = await client.query(
      `SELECT status
       FROM lark_sla_inbox
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
      await finish(
        "ORIGINAL_MESSAGE_REQUIRES_REVIEW",
        "REVIEW"
      );
      await client.query("COMMIT");
      return "ORIGINAL_MESSAGE_REQUIRES_REVIEW";
    }

    // 7. Đợi các message đã biết xảy ra trước reaction.
    const olderPending = await client.query(
      `SELECT 1
       FROM lark_sla_inbox
       WHERE conversation_id = $1
         AND status = 'PENDING'
         AND message_sent_at <= $2
       LIMIT 1`,
      [target.conversation_id, reaction.reacted_at]
    );

    if (olderPending.rowCount) {
      await client.query("COMMIT");
      return "WAITING_FOR_EARLIER_MESSAGES";
    }

    // 8. Tìm SLA có liên kết với đúng tin gốc.
    const slaResult = await client.query(
      `SELECT s.*
       FROM sla_trackings s
       JOIN sla_message_links l
         ON l.sla_id = s.id
       WHERE l.message_id = $1
       FOR UPDATE OF s`,
      [target.message_id]
    );

    if (!slaResult.rowCount) {
      await finish("NO_SLA_FOR_MESSAGE");
      await client.query("COMMIT");
      return "NO_SLA_FOR_MESSAGE";
    }

    const sla = slaResult.rows[0];

    const reactedAt = new Date(reaction.reacted_at);
    const waitingStarted = new Date(sla.waiting_started_at);

    if (
      !Number.isFinite(reactedAt.getTime()) ||
      reactedAt < waitingStarted
    ) {
      await finish(
        "INVALID_REACTION_TIME",
        "REVIEW",
        sla.id
      );
      await client.query("COMMIT");
      return "INVALID_REACTION_TIME";
    }

    // Reaction đến sau khi SLA đã đóng.
    if (sla.status !== "WAITING") {
      if (
        sla.status === "RESPONDED" &&
        sla.responded_at &&
        reactedAt < new Date(sla.responded_at)
      ) {
        // Reaction xảy ra trước phản hồi được ghi nhận:
        // cần rà soát KPI theo thứ tự thực tế.
        await client.query(
          `UPDATE lark_sla_processing
           SET requires_review = TRUE,
               updated_at = NOW()
           WHERE conversation_id = $1`,
          [target.conversation_id]
        );

        await finish(
          "REACTION_ARRIVED_LATE",
          "REVIEW",
          sla.id
        );

        await client.query("COMMIT");
        return "REACTION_ARRIVED_LATE";
      }

      await finish("SLA_ALREADY_CLOSED", "PROCESSED", sla.id);
      await client.query("COMMIT");
      return "SLA_ALREADY_CLOSED";
    }

    // Bước 189: Bổ sung kiểm tra event đến muộn hơn last_sent_at
    if (
      state.last_sent_at &&
      new Date(reaction.reacted_at) <
        new Date(state.last_sent_at)
    ) {
      await client.query(
        `UPDATE lark_sla_processing
         SET requires_review = TRUE,
             updated_at = NOW()
         WHERE conversation_id = $1`,
        [target.conversation_id]
      );

      await finish(
        "REACTION_ORDER_REQUIRES_REVIEW",
        "REVIEW",
        sla.id
      );

      await client.query("COMMIT");

      return "REACTION_ORDER_REQUIRES_REVIEW";
    }

    // 9. Đóng SLA bằng reaction emoji.
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

    // 10. Hủy các Reminder Job chưa bắt đầu.
    await client.query(
      `UPDATE reminder_jobs
       SET status = 'CANCELLED',
           completed_at = NOW()
       WHERE sla_id = $1
         AND status = 'PENDING'`,
      [sla.id]
    );

    // 11. Lưu kết quả reaction.
    await finish("SLA_CLOSED", "PROCESSED", sla.id);

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
  processLarkReaction
};
