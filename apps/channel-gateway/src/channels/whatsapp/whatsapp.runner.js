const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
require("dotenv").config({ path: path.resolve(__dirname, "../../../../../.env") });
require("dotenv").config();
require("../../../../../shared/logger");
require("../../../../../shared/validate-production-env")([
  "RABBITMQ_PASSWORD", "RABBITMQ_URL", "CONFIG_INTERNAL_API_KEY", "CONFIG_SERVICE_URL", "WA_INTERNAL_API_KEY"
]);
const { client, startWhatsApp } = require("./whatsapp.client");
const { normalizeWhatsAppMessage } = require("./whatsapp.adapter");
const {
  normalizeWhatsAppReaction,
  serializedId
} = require("./whatsapp-reaction.adapter");
const {
  handleWhatsAppVerification
} = require("./whatsapp-verification.service");
const {
  startWhatsAppInternalApi
} = require("./whatsapp-internal");
const {
  connectWhatsAppPublisher,
  publishWhatsAppMessage,
  publishWhatsAppReaction
} = require("../../publishers/whatsapp.publisher");

const allowedGroups = new Set(
  (process.env.WA_GROUP_IDS || "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean)
);

const startedAt = process.env.WA_MONITORING_STARTED_AT && Number.isFinite(new Date(process.env.WA_MONITORING_STARTED_AT).getTime())
  ? new Date(process.env.WA_MONITORING_STARTED_AT)
  : new Date();

if (!/^[1-9]\d*$/.test(process.env.WHATSAPP_CONNECTION_ID || "")) {
  throw new Error("Invalid WhatsApp monitoring configuration (check WHATSAPP_CONNECTION_ID)");
}

let connected = false;
const groupCache = new Map();

async function registerGroup({ groupId, groupName }) {
  const configServiceUrl = process.env.CONFIG_SERVICE_URL || "http://127.0.0.1:3002";
  const apiKey = process.env.CONFIG_INTERNAL_API_KEY;
  if (!apiKey) throw new Error("CONFIG_INTERNAL_API_KEY is required");
  const connectionId = process.env.WHATSAPP_CONNECTION_ID || 5;

  try {
    const res = await fetch(`${configServiceUrl}/internal/monitored-groups/discover`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-api-key": apiKey
      },
      body: JSON.stringify({
        channelConnectionId: connectionId,
        externalGroupId: groupId,
        groupName
      }),
      signal: AbortSignal.timeout(5000)
    });

    if (!res.ok) throw new Error(`Config service returned HTTP ${res.status}`);
    const data = await res.json();
    if (data?.success && data?.group) {
      return data.group;
    }
  } catch (error) {
    console.error("[WhatsApp Runner] monitored group lookup failed:", error.message);
  }

  // Fail closed: never authorize a group while the config service is unavailable.
  throw new Error("Monitored group could not be verified");
}

async function ensureMonitoredGroup(chat) {
  const groupId = chat.id?._serialized;
  if (!groupId) return null;

  const existing = groupCache.get(groupId);

  // Chỉ cache group ACTIVE trong 10 giây, để PAUSED/REVOKED có thể được áp dụng lại
  if (existing && Date.now() < existing.expiresAt) {
    return existing.group;
  }

  const group = await registerGroup({
    groupId,
    groupName: chat.name || null
  });

  groupCache.set(groupId, {
    group,
    expiresAt: Date.now() + 10000
  });

  return group;
}

client.on("ready", async () => {
  connected = true;
  try {
    const chats = await client.getChats();
    const groups = chats.filter(c => c.isGroup);
    for (const g of groups) await ensureMonitoredGroup(g);
    console.log("WhatsApp connection ready", { groupCount: groups.length });
  } catch (err) {
    console.error("[WhatsApp] Lỗi lấy danh sách nhóm:", err.message);
  }
});

// Sự kiện khi có thành viên/bot được thêm vào group mới
client.on("group_join", async notification => {
  try {
    const chat = await notification.getChat();
    if (chat?.isGroup) {
      await ensureMonitoredGroup(chat);
    }
  } catch (error) {
    console.error("[WhatsApp] group_join discovery error:", error.message);
  }
});

// Quét định kỳ mỗi 60 giây để phát hiện group mới nếu sự kiện group_join bị lỡ
setInterval(async () => {
  if (!connected) return;
  try {
    const chats = await client.getChats();
    for (const chat of chats) {
      if (chat.isGroup) {
        await ensureMonitoredGroup(chat);
      }
    }
  } catch { }
}, 60000);

client.on("disconnected", () => {
  connected = false;
});

client.on("auth_failure", () => {
  connected = false;
});

client.on("message_create", async message => {
  if (!connected) return;
  try {
    const chat = await message.getChat();
    if (!chat.isGroup) return;
    if (message.fromMe) return;

    // Tự động đăng ký group chưa có vào PostgreSQL qua Config Service
    const group = await ensureMonitoredGroup(chat);
    if (!group || group.status !== "ACTIVE") {
      console.log("WhatsApp message ignored: group is not active");
      return;
    }

    if (allowedGroups.size > 0 && !allowedGroups.has(chat.id._serialized)) {
      console.log("WhatsApp message ignored: group is not allowlisted");
      return;
    }

    // Chỉ xử lý tin sau mốc giám sát
    const sentAt = new Date(Number(message.timestamp) * 1000);
    const monitoringStartedAt = new Date(group.monitoring_started_at || startedAt);

    if (
      !Number.isFinite(sentAt.getTime()) ||
      !Number.isFinite(monitoringStartedAt.getTime()) ||
      sentAt < monitoringStartedAt
    ) {
      return;
    }

    const event = await normalizeWhatsAppMessage(
      client,
      message,
      process.env.WHATSAPP_CONNECTION_ID
    );
    if (!event) {
      console.log(`[WhatsApp Inbound] Tin nhắn bị bỏ qua (không phải tin nhóm hoặc là thông báo hệ thống)`);
      return;
    }

    event.monitoringStartedAt = group.monitoring_started_at || startedAt.toISOString();
    await publishWhatsAppMessage(event);
    console.log("WhatsApp published:", {
      eventId: event.eventId
    });
  } catch (error) {
    console.error("WhatsApp message processing failed:", error.message);
  }
});

client.on("message_reaction", async reaction => {
  if (!connected) {
    console.warn("[WhatsApp Reaction] ignored: client not ready");
    return;
  }
  try {
    const event = normalizeWhatsAppReaction(
      reaction,
      process.env.WHATSAPP_CONNECTION_ID
    );
    if (!event) {
      console.log(
        "[WhatsApp Reaction] ignored: no active emoji"
      );
      return;
    }
    if (new Date(event.reactedAt) < startedAt) {
      console.log("[WhatsApp Reaction] ignored: before monitoring start");
      return;
    }
    await publishWhatsAppReaction(event);
    console.log("WhatsApp reaction published:", {
      eventId: event.eventId
    });
  } catch (error) {
    console.error("WhatsApp reaction publish failed:", {
      error: error.message
    });
  }
});

client.on("message", async message => {
  try {
    await handleWhatsAppVerification(client, message);
  } catch (error) {
    console.error(
      "WhatsApp private message handler failed:",
      error.message
    );
  }
});

async function gracefulShutdown() {
  console.log("\n[WhatsApp] Đang đóng phiên trình duyệt an toàn...");
  try {
    await client.destroy();
  } catch { }
  process.exit(0);
}

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

async function main() {
  await connectWhatsAppPublisher();
  startWhatsAppInternalApi(client, () => connected, ensureMonitoredGroup);
  await startWhatsApp();
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
