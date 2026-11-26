const pool = require("../config/database");

const identityClient = {
  async resolveEmployee(telegramUserId) {
    const params = new URLSearchParams({
      platform: "TELEGRAM",
      platformUserId: String(telegramUserId)
    });

    const response = await fetch(
      `${process.env.IDENTITY_SERVICE_URL}/api/employees/resolve?${params}`,
      {
        headers: {
          "x-internal-api-key":
            process.env.IDENTITY_INTERNAL_API_KEY
        },
        signal: AbortSignal.timeout(5000)
      }
    );

    if (!response.ok) {
      throw new Error("Identity Service unavailable");
    }

    const result = await response.json();

    return result.data;
  }
};

async function processReaction(reaction) {
  // Gọi Identity trước khi mở DB transaction.
  const employee = await identityClient.resolveEmployee(
    reaction.actor_platform_id
  );

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Khóa reaction event để tránh xử lý đồng thời.
    const locked = await client.query(
      `SELECT *
       FROM message_reaction_events
       WHERE id = $1
       FOR UPDATE`,
      [reaction.id]
    );

    if (
      locked.rowCount === 0 ||
      locked.rows[0].processing_status !== "PENDING"
    ) {
      await client.query("COMMIT");
      return "ALREADY_PROCESSED";
    }

    async function finish(result, slaId = null, status = "PROCESSED") {
      await client.query(
        `UPDATE message_reaction_events
         SET processing_status = $1,
             processing_result = $2,
             sla_id = $3,
             processed_at = NOW()
         WHERE id = $4`,
        [status, result, slaId, reaction.id]
      );
    }

    // Người reaction phải là nhân viên đã xác thực.
    if (!employee) {
      await finish("NOT_EMPLOYEE");
      await client.query("COMMIT");
      return "NOT_EMPLOYEE";
    }

    // Tìm conversation tương ứng với Bot + Group.
    const conversationResult = await client.query(
      `SELECT id
       FROM conversations
       WHERE channel_connection_id = $1
         AND external_chat_id = $2
         AND status = 'ACTIVE'`,
      [
        reaction.channel_connection_id,
        reaction.external_chat_id
      ]
    );

    if (conversationResult.rowCount === 0) {
      // Có thể tin nhắn gốc chưa được Conversation lưu.
      await client.query("COMMIT");
      return "WAITING_FOR_CONVERSATION";
    }

    const conversationId = conversationResult.rows[0].id;

    // Khóa cursor để tuần tự hóa với SLA Inbox Worker.
    const cursorResult = await client.query(
      `SELECT *
       FROM sla_conversation_processing
       WHERE conversation_id = $1
       FOR UPDATE`,
      [conversationId]
    );

    if (cursorResult.rowCount === 0) {
      await client.query("COMMIT");
      return "WAITING_FOR_INBOX";
    }

    const cursor = cursorResult.rows[0];

    if (cursor.requires_review) {
      await client.query("COMMIT");
      return "CONVERSATION_REQUIRES_REVIEW";
    }

    // Tìm tin gốc được Sales reaction.
    const originalResult = await client.query(
      `SELECT m.id, m.sender_type
       FROM messages m
       WHERE m.conversation_id = $1
         AND m.platform_message_id = $2`,
      [conversationId, reaction.target_message_id]
    );

    if (originalResult.rowCount === 0) {
      await client.query("COMMIT");
      return "WAITING_FOR_ORIGINAL_MESSAGE";
    }

    const original = originalResult.rows[0];

    // Không tính reaction trên tin của Sales hoặc Bot.
    if (original.sender_type !== "CUSTOMER") {
      await finish("TARGET_NOT_CUSTOMER");
      await client.query("COMMIT");
      return "TARGET_NOT_CUSTOMER";
    }

    // Đợi tin gốc đi qua SLA Inbox trước.
    const inboxResult = await client.query(
      `SELECT status
       FROM sla_event_inbox
       WHERE conversation_id = $1
         AND platform_message_id = $2`,
      [conversationId, reaction.target_message_id]
    );

    if (
      inboxResult.rowCount === 0 ||
      inboxResult.rows[0].status === "PENDING"
    ) {
      await client.query("COMMIT");
      return "WAITING_FOR_SLA_INBOX";
    }

    if (inboxResult.rows[0].status !== "PROCESSED") {
      await finish("ORIGINAL_REQUIRES_REVIEW", null, "REVIEW");
      await client.query("COMMIT");
      return "ORIGINAL_REQUIRES_REVIEW";
    }

    // Tìm SLA chứa message được reaction,
    // kể cả SLA đã đóng để tránh khớp sai lượt mới.
    const slaResult = await client.query(
      `SELECT s.*
       FROM sla_trackings s
       JOIN sla_message_links l ON l.sla_id = s.id
       WHERE l.message_id = $1
       FOR UPDATE OF s`,
      [original.id]
    );

    if (slaResult.rowCount === 0) {
      await finish("NO_SLA_FOR_MESSAGE");
      await client.query("COMMIT");
      return "NO_SLA_FOR_MESSAGE";
    }

    const sla = slaResult.rows[0];
    const reactedAt = new Date(reaction.reacted_at);

    if (
      !Number.isFinite(reactedAt.getTime()) ||
      reactedAt < new Date(sla.waiting_started_at)
    ) {
      await finish("INVALID_REACTION_TIME");
      await client.query("COMMIT");
      return "INVALID_REACTION_TIME";
    }

    if (sla.status !== "WAITING") {
      // Nếu phản hồi khác được ghi nhận SAU thời điểm reaction,
      // cần review lại thứ tự các phản hồi.
      if (
        sla.status === "RESPONDED" &&
        reactedAt < new Date(sla.responded_at)
      ) {
        await client.query(
          `UPDATE sla_conversation_processing
           SET requires_review = TRUE,
               updated_at = NOW()
           WHERE conversation_id = $1`,
          [conversationId]
        );

        await finish("REACTION_ARRIVED_LATE", sla.id, "REVIEW");
        await client.query("COMMIT");
        return "REACTION_ARRIVED_LATE";
      }

      await finish("SLA_ALREADY_CLOSED", sla.id);
      await client.query("COMMIT");
      return "SLA_ALREADY_CLOSED";
    }

    // Step 133: Kiểm tra thứ tự trước khi đóng SLA
    // Tránh đóng SLA khi còn tin nhắn cũ chưa xử lý trong Inbox
    const olderPending = await client.query(
      `SELECT 1
       FROM sla_event_inbox
       WHERE conversation_id = $1
         AND status = 'PENDING'
         AND (payload->>'sentAt')::timestamptz <= $2
       LIMIT 1`,
      [conversationId, reaction.reacted_at]
    );

    if (olderPending.rowCount > 0) {
      await client.query("COMMIT");
      return "WAITING_FOR_EARLIER_MESSAGES";
    }

    // Đóng SLA bằng reaction.
    await client.query(
      `UPDATE sla_trackings
       SET status = 'RESPONDED',
           responded_at = $2,
           response_employee_id = $3,
           response_method = 'REACTION',
           response_message_id = NULL,
           next_reminder_at = NULL,
           updated_at = NOW()
       WHERE id = $1
         AND status = 'WAITING'`,
      [sla.id, reaction.reacted_at, employee.id]
    );

    // Hủy những reminder chưa bắt đầu.
    await client.query(
      `UPDATE reminder_jobs
       SET status = 'CANCELLED',
           completed_at = NOW()
       WHERE sla_id = $1
         AND status = 'PENDING'`,
      [sla.id]
    );

    await finish("SLA_CLOSED", sla.id);

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
  processReaction,
  identityClient
};
