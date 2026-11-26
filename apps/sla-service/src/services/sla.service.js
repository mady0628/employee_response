const repository = require("../repositories/sla.repository");

async function handleCustomerMessage(client, event) {
  const waitingSlas = await repository.findWaitingSlas(
    client,
    event.conversationId
  );
  const policy = await repository.getPolicy(client);

  // Tìm SLA đang mở của khách vừa nhắn.
  const existingSla = [...waitingSlas].reverse().find(
    sla => sla.customer_platform_id === event.senderPlatformId
  );

  const slaStartedAt = existingSla
    ? new Date(existingSla.waiting_started_at).getTime()
    : null;
  const messageSentAt = new Date(event.sentAt).getTime();
  const startsNewSla = existingSla &&
    Number.isFinite(slaStartedAt) &&
    messageSentAt - slaStartedAt > policy.new_sla_gap_minutes * 60 * 1000;

  // Ngưỡng mở SLA mới được cấu hình trong chính sách SLA.
  if (existingSla && !startsNewSla) {
    await repository.linkMessage(
      client,
      existingSla.id,
      event.messageId
    );
    return { action: "MESSAGE_LINKED", slaId: existingSla.id };
  }

  // Khách mới hoặc khách nhắn lại sau ngưỡng cấu hình sẽ mở SLA riêng.
  // Khi có nhiều SLA đang chờ, các SLA cũ bắt buộc được Reply trực tiếp.
  const requiresReply = waitingSlas.length > 0;

  if (requiresReply) {
    await repository.requireReply(
      client,
      waitingSlas.map(sla => sla.id)
    );
  }

  const sla = await repository.createSla(
    client,
    event,
    requiresReply
  );

  await repository.linkMessage(
    client,
    sla.id,
    event.messageId
  );

  return { action: "SLA_CREATED", slaId: sla.id, requiresReply };
}

async function handleEmployeeMessage(client, event) {
  // Ưu tiên Reply trực tiếp.
  if (event.replyToPlatformMessageId) {
    const sla = await repository.findWaitingSlaByReply(
      client,
      event.conversationId,
      event.replyToPlatformMessageId
    );

    if (!sla) {
      return { action: "IGNORED", reason: "REPLY_NOT_MATCHED" };
    }

    // Không tính phản hồi ngược thời gian.
    if (
      new Date(event.sentAt).getTime() <
      new Date(sla.waiting_started_at).getTime()
    ) {
      return { action: "IGNORED", reason: "INVALID_RESPONSE_TIME" };
    }

    const closed = await repository.closeSla(
      client,
      sla.id,
      event,
      "DIRECT_REPLY"
    );

    if (!closed) {
      return {
        action: "IGNORED",
        reason: "SLA_ALREADY_CLOSED"
      };
    }

    return {
      action: "SLA_RESPONDED",
      slaId: closed.id,
      method: "DIRECT_REPLY"
    };
  }

  // Sales nhắn thường, không Reply.
  const waitingSlas = await repository.findWaitingSlas(
    client,
    event.conversationId
  );

  // Có nhiều khách cùng chờ => bắt buộc Reply.
  if (waitingSlas.length !== 1) {
    return {
      action: "IGNORED",
      reason: "WAITING_CUSTOMER_COUNT_NOT_ONE"
    };
  }

  const sla = waitingSlas[0];

  // Sticky: trước đó từng có nhiều khách cùng chờ.
  if (sla.requires_explicit_reply) {
    return {
      action: "IGNORED",
      reason: "EXPLICIT_REPLY_REQUIRED"
    };
  }

  if (
    new Date(event.sentAt).getTime() <
    new Date(sla.waiting_started_at).getTime()
  ) {
    return { action: "IGNORED", reason: "INVALID_RESPONSE_TIME" };
  }

  const closed = await repository.closeSla(
    client,
    sla.id,
    event,
    "SINGLE_WAITING_CUSTOMER"
  );

  if (!closed) {
    return {
      action: "IGNORED",
      reason: "SLA_ALREADY_CLOSED"
    };
  }

  return {
    action: "SLA_RESPONDED",
    slaId: closed.id,
    method: "SINGLE_WAITING_CUSTOMER"
  };
}

async function processMessageInTransaction(client, event) {
  if (
    event.eventType !== "conversation.message.saved" ||
    !event.eventId ||
    !/^[1-9]\d*$/.test(String(event.conversationId))
  ) {
    throw new Error("Invalid SLA event");
  }

  const registered = await client.query(
    `INSERT INTO sla_processed_events (event_id)
     VALUES ($1)
     ON CONFLICT DO NOTHING
     RETURNING event_id`,
    [event.eventId]
  );

  if (registered.rowCount === 0) {
    return { action: "DUPLICATE" };
  }

  const conversation = await client.query(
    `SELECT status
     FROM conversations
     WHERE id = $1
     FOR SHARE`,
    [event.conversationId]
  );

  if (conversation.rowCount === 0 || conversation.rows[0].status !== "ACTIVE") {
    return {
      action: "IGNORED",
      reason: "CONVERSATION_READING_DISABLED"
    };
  }

  switch (event.senderType) {
    case "CUSTOMER":
      return handleCustomerMessage(client, event);

    case "EMPLOYEE":
      return handleEmployeeMessage(client, event);

    default:
      return {
        action: "IGNORED",
        reason: "NOT_CUSTOMER_OR_EMPLOYEE"
      };
  }
}

async function processMessageEvent(event) {
  const client = await repository.pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `SELECT pg_advisory_xact_lock($1::bigint)`,
      [event.conversationId]
    );

    const result = await processMessageInTransaction(
      client,
      event
    );

    await client.query("COMMIT");

    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  processMessageEvent,
  processMessageInTransaction
};
