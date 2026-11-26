const {
  WhatsAppSessionManager
} = require("../managers/whatsapp-session.manager");

const {
  normalizeWhatsAppMessage
} = require("../channels/whatsapp/whatsapp.adapter");

const {
  normalizeWhatsAppReaction
} = require("../channels/whatsapp/whatsapp-reaction.adapter");

const {
  handleWhatsAppVerification
} = require("../channels/whatsapp/whatsapp-verification.service");

const {
  publishWhatsAppMessage,
  publishWhatsAppReaction
} = require("../publishers/whatsapp.publisher");

const {
  updateConnectionRuntime
} = require("../clients/config.client");

const configServiceUrl =
  process.env.CONFIG_SERVICE_URL || "http://127.0.0.1:3002";
const configApiKey =
  process.env.CONFIG_INTERNAL_API_KEY ||
  process.env.GATEWAY_INTERNAL_API_KEY;

// Cache monitored groups theo connectionId:groupId
const groupCache = new Map();

function cacheGroup(cacheKey, group, ttlMs) {
  const now = Date.now();
  if (groupCache.size >= 10000) {
    for (const [key, value] of groupCache) {
      if (value.expiresAt <= now) groupCache.delete(key);
    }
    while (groupCache.size >= 10000) {
      groupCache.delete(groupCache.keys().next().value);
    }
  }
  groupCache.set(cacheKey, { group, expiresAt: now + ttlMs });
}

async function ensureMonitoredGroup({ connectionId, groupId, groupName }) {
  const cacheKey = `${connectionId}:${groupId}`;
  const existing = groupCache.get(cacheKey);

  if (existing && Date.now() < existing.expiresAt) {
    return existing.group;
  }

  try {
    const res = await fetch(
      `${configServiceUrl}/internal/monitored-groups/discover`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-api-key": configApiKey
        },
        body: JSON.stringify({
          channelConnectionId: connectionId,
          externalGroupId: groupId,
          groupName: groupName || null
        }),
        signal: AbortSignal.timeout(5000)
      }
    );

    const data = await res.json();
    if (data?.success && data?.group) {
      cacheGroup(cacheKey, data.group, 10000);
      return data.group;
    }
  } catch (error) {
    console.error(
      `[WhatsApp Session Service] ensureMonitoredGroup failed for conn #${connectionId}:`,
      error.message
    );
  }

  // Fail closed: do not process data while authorization cannot be verified.
  cacheGroup(cacheKey, null, 2000);
  return null;
}

const manager = new WhatsAppSessionManager({
  async onMessage(connectionId, client, message) {
    // 1. Nếu là tin nhắn riêng, xử lý lệnh xác thực nhân viên (/verify)
    const chat = await message.getChat();
    if (!chat.isGroup) {
      try {
        await handleWhatsAppVerification(client, message);
      } catch (err) {
        console.error("[WhatsApp Session Service] Verification handler failed:", err.message);
      }
      return;
    }

    // 2. Bỏ qua tin do chính tài khoản giám sát gửi trong group
    if (message.fromMe) return;

    // 3. Chuẩn hóa tin nhắn
    const event = await normalizeWhatsAppMessage(
      client,
      message,
      connectionId
    );

    if (!event) return;

    // 4. Đăng ký & kiểm tra trạng thái group qua Config Service
    const group = await ensureMonitoredGroup({
      connectionId,
      groupId: event.conversation.externalId,
      groupName: event.conversation.title
    });

    if (!group || group.status !== "ACTIVE") {
      return;
    }

    if (
      new Date(event.message.sentAt) <
      new Date(group.monitoring_started_at)
    ) {
      return;
    }

    event.monitoringStartedAt = group.monitoring_started_at;

    // 5. Đẩy sang RabbitMQ để Conversation & SLA Service xử lý
    await publishWhatsAppMessage(event);
  },

  async onReaction(connectionId, reaction) {
    const event = normalizeWhatsAppReaction(
      reaction,
      connectionId
    );

    if (!event) return;

    await publishWhatsAppReaction(event);
  },

  async onStatus(connectionId, status, details, generation) {
    try {
      await updateConnectionRuntime({
        connectionId,
        generation: generation || 1,
        status,
        details: details || {}
      });
    } catch (error) {
      console.error(
        `[WhatsApp Session Service] Cannot update connection runtime for conn #${connectionId}:`,
        error.message
      );
    }
  },

  async onGroupDiscovered(connectionId, groupId, groupName) {
    try {
      await ensureMonitoredGroup({
        connectionId,
        groupId,
        groupName
      });
    } catch (error) {
      console.error(
        `[WhatsApp Session Service] onGroupDiscovered error for conn #${connectionId}:`,
        error.message
      );
    }
  }
});

module.exports = {
  manager,
  ensureMonitoredGroup,
  updateConnectionRuntime
};
