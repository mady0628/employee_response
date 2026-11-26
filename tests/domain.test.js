const test = require("node:test");
const assert = require("node:assert/strict");

const slaRepository = require("../apps/sla-service/src/repositories/sla.repository");
const { processMessageInTransaction } = require("../apps/sla-service/src/services/sla.service");
const conversationRepository = require("../apps/conversation-service/src/repositories/conversation.repository");
const identityClient = require("../apps/conversation-service/src/clients/identity.client");
const { processTelegramMessage } = require("../apps/conversation-service/src/services/conversation.service");
const { isGroupMember, buildReminderMessage } = require("../apps/reminder-service/src/services/reminder.service");
const { buildLarkReminder } = require("../apps/reminder-service/src/services/lark-reminder.service");
const employeeRepository = require("../apps/identity-service/src/repositories/employee.repository");
const { createEmployee, getEmployeeById, resolveEmployee } = require("../apps/identity-service/src/services/employee.service");
const { addSupportMinutes, isWithinSupportHours, supportMinutesBetween } = require("../shared/support-hours");
const { responseSlaMinutes } = require("../apps/sla-service/src/services/response-time-report.service");
const { deferIfOutsideSupportHours } = require("../apps/reminder-service/src/services/reminder-hours");

function setupSlaRepository(overrides = {}) {
  const original = {};
  const defaults = {
    findWaitingSlas: async () => [],
    getPolicy: async () => ({ new_sla_gap_minutes: 5 }),
    createSla: async () => ({ id: 42 }),
    linkMessage: async () => {},
    requireReply: async () => {},
    findWaitingSlaByReply: async () => null,
    closeSla: async (_client, id) => ({ id }),
    cancelPendingReminders: async () => []
  };
  for (const [name, fn] of Object.entries({ ...defaults, ...overrides })) {
    original[name] = slaRepository[name];
    slaRepository[name] = fn;
  }
  return () => Object.assign(slaRepository, original);
}

function fakeSlaClient({ duplicate = false, conversationStatus = "ACTIVE" } = {}) {
  return {
    async query(sql) {
      if (sql.includes("INSERT INTO sla_processed_events")) {
        return { rowCount: duplicate ? 0 : 1, rows: [] };
      }
      if (sql.includes("FROM conversations")) {
        return conversationStatus
          ? { rowCount: 1, rows: [{ status: conversationStatus }] }
          : { rowCount: 0, rows: [] };
      }
      throw new Error(`Unexpected SQL in test: ${sql}`);
    }
  };
}

const baseEvent = {
  eventType: "conversation.message.saved",
  eventId: "event-1",
  conversationId: "7",
  messageId: 101,
  sentAt: "2026-01-01T10:00:00.000Z",
  senderPlatformId: "customer-1",
  senderType: "CUSTOMER"
};

test("support clock pauses at breaks and starts off-hour SLAs in the next window", () => {
  const at1159 = new Date("2026-11-23T04:59:00.000Z");
  assert.equal(addSupportMinutes(at1159, 10).toISOString(), "2026-11-23T06:09:00.000Z");
  assert.equal(addSupportMinutes(at1159, 1).toISOString(), "2026-11-23T06:00:00.000Z");
  assert.equal(addSupportMinutes(new Date("2026-11-23T05:30:00.000Z"), 10).toISOString(), "2026-11-23T06:10:00.000Z");
  assert.equal(addSupportMinutes(new Date("2026-11-23T16:00:00.000Z"), 10).toISOString(), "2026-11-24T01:10:00.000Z");
  assert.equal(isWithinSupportHours(new Date("2026-11-23T05:30:00.000Z")), false);
  assert.equal(isWithinSupportHours(new Date("2026-11-23T06:00:00.000Z")), true);
  assert.equal(supportMinutesBetween(at1159, new Date("2026-11-23T06:10:00.000Z")), 11);
  assert.equal(responseSlaMinutes(at1159, new Date("2026-11-23T05:30:00.000Z")), 31);
});

test("reminder jobs defer until support resumes and remain claimable during support time", async () => {
  let deferred;
  const fakeRepository = { deferJobUntil: async (jobId, at) => { deferred = { jobId, at }; } };
  assert.equal(await deferIfOutsideSupportHours(fakeRepository, 9, new Date("2026-11-23T05:30:00.000Z")), true);
  assert.equal(deferred.jobId, 9);
  assert.equal(deferred.at.toISOString(), "2026-11-23T06:00:00.000Z");
  assert.equal(await deferIfOutsideSupportHours(fakeRepository, 10, new Date("2026-11-23T06:00:00.000Z")), false);
});

test("SLA rejects malformed events before recording them", async () => {
  await assert.rejects(
    processMessageInTransaction(fakeSlaClient(), { ...baseEvent, conversationId: "0" }),
    /Invalid SLA event/
  );
});

test("SLA ignores duplicate events and inactive conversations", async () => {
  assert.deepEqual(
    await processMessageInTransaction(fakeSlaClient({ duplicate: true }), baseEvent),
    { action: "DUPLICATE" }
  );
  assert.deepEqual(
    await processMessageInTransaction(fakeSlaClient({ conversationStatus: "PAUSED" }), baseEvent),
    { action: "IGNORED", reason: "CONVERSATION_READING_DISABLED" }
  );
});

test("SLA opens a new customer request and links its message", async () => {
  let created;
  let linked;
  const restore = setupSlaRepository({
    createSla: async (_client, event, requiresReply) => {
      created = { event, requiresReply };
      return { id: 42 };
    },
    linkMessage: async (_client, slaId, messageId) => { linked = { slaId, messageId }; }
  });
  try {
    const result = await processMessageInTransaction(fakeSlaClient(), baseEvent);
    assert.deepEqual(result, { action: "SLA_CREATED", slaId: 42, requiresReply: false });
    assert.equal(created.event, baseEvent);
    assert.equal(created.requiresReply, false);
    assert.deepEqual(linked, { slaId: 42, messageId: 101 });
  } finally { restore(); }
});

test("SLA links follow-up messages and requires explicit replies for concurrent customers", async () => {
  let linked;
  const firstRestore = setupSlaRepository({
    findWaitingSlas: async () => [{
      id: 9,
      customer_platform_id: "customer-1",
      waiting_started_at: "2026-01-01T09:58:00.000Z"
    }],
    linkMessage: async (_client, id, messageId) => { linked = { id, messageId }; }
  });
  try {
    assert.deepEqual(
      await processMessageInTransaction(fakeSlaClient(), baseEvent),
      { action: "MESSAGE_LINKED", slaId: 9 }
    );
    assert.deepEqual(linked, { id: 9, messageId: 101 });
  } finally { firstRestore(); }

  let requiredIds;
  let createdRequiresReply;
  const secondRestore = setupSlaRepository({
    findWaitingSlas: async () => [{ id: 9, customer_platform_id: "other-customer" }],
    requireReply: async (_client, ids) => { requiredIds = ids; },
    createSla: async (_client, _event, requiresReply) => {
      createdRequiresReply = requiresReply;
      return { id: 43 };
    }
  });
  try {
    const result = await processMessageInTransaction(fakeSlaClient(), baseEvent);
    assert.equal(result.requiresReply, true);
    assert.deepEqual(requiredIds, [9]);
    assert.equal(createdRequiresReply, true);
  } finally { secondRestore(); }
});

test("SLA creates a new customer request when the configured gap is exceeded", async () => {
  let createdRequiresReply;
  let linkedMessage;
  const restore = setupSlaRepository({
    findWaitingSlas: async () => [{
      id: 9,
      customer_platform_id: "customer-1",
      waiting_started_at: "2026-01-01T09:54:59.000Z"
    }],
    createSla: async (_client, _event, requiresReply) => {
      createdRequiresReply = requiresReply;
      return { id: 43 };
    },
    linkMessage: async (_client, slaId, messageId) => { linkedMessage = { slaId, messageId }; }
  });
  try {
    const result = await processMessageInTransaction(fakeSlaClient(), {
      ...baseEvent,
      sentAt: "2026-01-01T10:00:00.000Z"
    });
    assert.deepEqual(result, { action: "SLA_CREATED", slaId: 43, requiresReply: true });
    assert.equal(createdRequiresReply, true);
    assert.deepEqual(linkedMessage, { slaId: 43, messageId: 101 });
  } finally { restore(); }
});

test("SLA gap uses the configured number of minutes", async () => {
  let created = false;
  let linked;
  const restore = setupSlaRepository({
    findWaitingSlas: async () => [{
      id: 9,
      customer_platform_id: "customer-1",
      waiting_started_at: "2026-01-01T09:56:00.000Z"
    }],
    getPolicy: async () => ({ new_sla_gap_minutes: 3 }),
    createSla: async () => { created = true; return { id: 43 }; },
    linkMessage: async (_client, slaId, messageId) => { linked = { slaId, messageId }; }
  });
  try {
    const result = await processMessageInTransaction(fakeSlaClient(), {
      ...baseEvent,
      sentAt: "2026-01-01T10:00:00.000Z"
    });
    assert.deepEqual(result, { action: "SLA_CREATED", slaId: 43, requiresReply: true });
    assert.equal(created, true);
    assert.deepEqual(linked, { slaId: 43, messageId: 101 });
  } finally { restore(); }
});

test("SLA closes one waiting request from a plain employee response", async () => {
  let closeArgs;
  const restore = setupSlaRepository({
    findWaitingSlas: async () => [{ id: 9, requires_explicit_reply: false, waiting_started_at: "2026-01-01T09:00:00Z" }],
    closeSla: async (...args) => { closeArgs = args; return { id: 9 }; }
  });
  try {
    const result = await processMessageInTransaction(fakeSlaClient(), {
      ...baseEvent, senderType: "EMPLOYEE", employeeId: 5, sentAt: "2026-01-01T10:01:00Z"
    });
    assert.deepEqual(result, { action: "SLA_RESPONDED", slaId: 9, method: "SINGLE_WAITING_CUSTOMER" });
    assert.equal(closeArgs[3], "SINGLE_WAITING_CUSTOMER");
  } finally { restore(); }
});

test("SLA enforces explicit reply after multiple customers and rejects replies before the wait", async () => {
  const stickyRestore = setupSlaRepository({
    findWaitingSlas: async () => [{ id: 9, requires_explicit_reply: true }]
  });
  try {
    assert.deepEqual(
      await processMessageInTransaction(fakeSlaClient(), { ...baseEvent, senderType: "EMPLOYEE" }),
      { action: "IGNORED", reason: "EXPLICIT_REPLY_REQUIRED" }
    );
  } finally { stickyRestore(); }

  const replyRestore = setupSlaRepository({
    findWaitingSlaByReply: async () => ({ id: 10, waiting_started_at: "2026-01-01T10:00:00Z" })
  });
  try {
    assert.deepEqual(
      await processMessageInTransaction(fakeSlaClient(), {
        ...baseEvent, senderType: "EMPLOYEE", replyToPlatformMessageId: "original",
        sentAt: "2026-01-01T09:59:59Z"
      }),
      { action: "IGNORED", reason: "INVALID_RESPONSE_TIME" }
    );
  } finally { replyRestore(); }
});

test("conversation classifies Telegram bot, employee and customer messages", async () => {
  const originals = {
    enabled: conversationRepository.isReadingEnabled,
    save: conversationRepository.saveMessage,
    resolve: identityClient.resolveEmployee
  };
  try {
    conversationRepository.isReadingEnabled = async () => true;
    conversationRepository.saveMessage = async (_event, senderType, employeeId) => ({ senderType, employeeId });
    identityClient.resolveEmployee = async () => ({ id: 88 });
    const event = { platform: "TELEGRAM", sender: { isBot: false, externalId: "1" } };
    assert.deepEqual(await processTelegramMessage(event), { senderType: "EMPLOYEE", employeeId: 88 });
    identityClient.resolveEmployee = async () => null;
    assert.deepEqual(await processTelegramMessage(event), { senderType: "CUSTOMER", employeeId: null });
    assert.deepEqual(await processTelegramMessage({ ...event, sender: { isBot: true } }), { senderType: "BOT", employeeId: null });
    conversationRepository.isReadingEnabled = async () => false;
    assert.equal((await processTelegramMessage(event)).ignored, true);
  } finally {
    conversationRepository.isReadingEnabled = originals.enabled;
    conversationRepository.saveMessage = originals.save;
    identityClient.resolveEmployee = originals.resolve;
  }
});

test("reminder recipient membership recognizes active and restricted members", () => {
  for (const status of ["creator", "administrator", "member"]) assert.equal(isGroupMember({ status }), true);
  assert.equal(isGroupMember({ status: "restricted", isMember: true }), true);
  assert.equal(isGroupMember({ status: "restricted", isMember: false }), false);
  assert.equal(isGroupMember({ status: "left" }), false);
});

test("Telegram and Lark reminders produce actionable content and safe fallbacks", () => {
  const context = {
    waiting_started_at: new Date(Date.now() - 12 * 60000).toISOString(),
    group_title: "Sales Team", external_chat_id: "chat-1", sender_display_name: "Customer",
    customer_platform_id: "customer-1", customer_message_content: "Please call me",
    reminder_number: 2
  };
  const telegram = buildReminderMessage(context);
  assert.match(telegram, /Sales Team/);
  assert.match(telegram, /Please call me/);
  assert.match(telegram, /Lần nhắc: 2/);
  assert.match(buildReminderMessage({ ...context, customer_message_content: "  ", customer_message_type: "PHOTO" }), /PHOTO không có nội dung văn bản/);
  assert.match(buildLarkReminder(context), /customer-1/);
  assert.match(buildLarkReminder({ ...context, group_title: null }), /chat-1/);
});

test("employee service validates input and normalizes accepted values", async () => {
  const originalCreate = employeeRepository.createEmployee;
  let saved;
  employeeRepository.createEmployee = async data => { saved = data; return data; };
  try {
    await assert.rejects(createEmployee({ fullName: " " }), { status: 400 });
    await assert.rejects(createEmployee({ fullName: "Valid", email: "not-an-email" }), { status: 400 });
    assert.deepEqual(await createEmployee({ fullName: "  Ada  ", email: " ADA@EXAMPLE.COM " }), {
      fullName: "Ada", email: "ada@example.com"
    });
    assert.deepEqual(saved, { fullName: "Ada", email: "ada@example.com" });
    await assert.rejects(getEmployeeById("0"), { status: 400 });
    await assert.rejects(resolveEmployee("UNKNOWN", "id"), { status: 400 });
    await assert.rejects(resolveEmployee("TELEGRAM", "not-numeric"), { status: 400 });
  } finally { employeeRepository.createEmployee = originalCreate; }
});
