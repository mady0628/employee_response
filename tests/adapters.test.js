const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeTelegramMessage } = require("../apps/channel-gateway/src/channels/telegram/telegram.adapter");
const { normalizeLarkMessage } = require("../apps/channel-gateway/src/channels/lark/lark.adapter");
const { normalizeWhatsAppMessage } = require("../apps/channel-gateway/src/channels/whatsapp/whatsapp.adapter");

test("Telegram adapter normalizes a group text message and reply", () => {
  const event = normalizeTelegramMessage({ message: {
    message_id: 17,
    date: 1700000000,
    text: "Hello",
    chat: { id: -100123, type: "supergroup", title: "Sales" },
    from: { id: 42, first_name: "Ada", last_name: "Lovelace", username: "ada", is_bot: false },
    reply_to_message: { message_id: 16 }
  } }, 3);

  assert.equal(event.eventId, "telegram:3:-100123:17");
  assert.equal(event.platform, "TELEGRAM");
  assert.equal(event.conversation.type, "GROUP");
  assert.equal(event.sender.displayName, "Ada Lovelace");
  assert.equal(event.message.replyToExternalMessageId, "16");
  assert.equal(event.message.content, "Hello");
});

test("Telegram adapter ignores non-group, missing and senderless updates", () => {
  assert.equal(normalizeTelegramMessage({}, 1), null);
  assert.equal(normalizeTelegramMessage({ message: {
    chat: { id: 1, type: "private" }, from: { id: 2 }
  } }, 1), null);
  assert.equal(normalizeTelegramMessage({ message: {
    chat: { id: 1, type: "group" }
  } }, 1), null);
});

test("Lark adapter reads text content and rejects invalid event identifiers", () => {
  const event = normalizeLarkMessage({
    sender: { sender_type: "user", sender_id: { open_id: "ou_1" } },
    message: {
      chat_type: "group", chat_id: "oc_1", message_id: "om_1",
      create_time: "1700000000000", message_type: "text", content: '{"text":"Hi"}'
    }
  }, 2);
  assert.equal(event.message.content, "Hi");
  assert.equal(event.message.sentAt, "2023-11-14T22:13:20.000Z");
  assert.equal(normalizeLarkMessage({ sender: {}, message: { chat_type: "p2p" } }, 2), null);
  assert.throws(() => normalizeLarkMessage({
    sender: {}, message: { chat_type: "group" }
  }, 2), /Missing Lark/);
  assert.throws(() => normalizeLarkMessage({
    sender: { sender_id: { open_id: "u" } },
    message: { chat_type: "group", chat_id: "c", message_id: "m", create_time: "bad" }
  }, 2), /timestamp/);
});

test("WhatsApp adapter ignores private and senderless messages", async () => {
  const privateMessage = { getChat: async () => ({ isGroup: false }) };
  assert.equal(await normalizeWhatsAppMessage({}, privateMessage, 1), null);
  const senderless = {
    getChat: async () => ({ isGroup: true, id: { _serialized: "group@g.us" } }),
    _data: {}, fromMe: false
  };
  assert.equal(await normalizeWhatsAppMessage({}, senderless, 1), null);
});

test("WhatsApp adapter preserves message metadata, monitor identity and quoted reply", async () => {
  const message = {
    getChat: async () => ({ isGroup: true, id: { _serialized: "group@g.us" }, name: "Sales" }),
    getContact: async () => ({ pushname: "Sam" }),
    getQuotedMessage: async () => ({ id: { _serialized: "quoted" } }),
    author: "15551234567@c.us", id: { _serialized: "message-1" },
    timestamp: 1700000000, hasQuotedMsg: true, type: "chat", body: "Need help", fromMe: false
  };
  const event = await normalizeWhatsAppMessage({}, message, 5);
  assert.equal(event.eventId, "whatsapp:5:message-1");
  assert.equal(event.sender.externalId, "15551234567@c.us");
  assert.equal(event.sender.displayName, "Sam");
  assert.equal(event.message.replyToExternalMessageId, "quoted");

  const own = { ...message, fromMe: true, author: null, hasQuotedMsg: false, getQuotedMessage: undefined };
  own.getContact = async () => ({ name: "Monitor" });
  const ownEvent = await normalizeWhatsAppMessage({ info: { wid: { _serialized: "monitor@c.us" } } }, own, 5);
  assert.equal(ownEvent.sender.isMonitor, true);
  assert.equal(ownEvent.sender.externalId, "monitor@c.us");
});

test("WhatsApp adapter rejects missing message IDs and invalid timestamps", async () => {
  const base = {
    getChat: async () => ({ isGroup: true, id: { _serialized: "group@g.us" } }),
    getContact: async () => ({}), author: "15551234567@c.us", id: {}, timestamp: 10
  };
  await assert.rejects(normalizeWhatsAppMessage({}, base, 1), /message ID missing/);
  await assert.rejects(normalizeWhatsAppMessage({}, { ...base, id: { _serialized: "m" }, timestamp: 0 }, 1), /timestamp/);
});
