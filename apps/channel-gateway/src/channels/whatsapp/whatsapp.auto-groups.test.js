const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
require("dotenv").config();

const {
  client,
  startWhatsApp
} = require("./whatsapp.client");

// Các group đã phát hiện trong phiên chạy.
const knownGroups = new Set();

let readyAt = null;

async function discoverGroup(chat) {
  if (!chat?.isGroup) return;

  const groupId = chat.id?._serialized;
  if (!groupId) return;

  if (knownGroups.has(groupId)) return;

  knownGroups.add(groupId);

  console.log("\n=== GROUP DETECTED ===");
  console.log("Name:", chat.name);
  console.log("Group ID:", groupId);
  console.log("======================\n");
}

// 1. Khi kết nối thành công: Quét tất cả group đang tham gia.
client.on("ready", async () => {
  readyAt = Date.now();

  console.log("\n[WhatsApp] READY!");
  console.log("Đang quét danh sách group...");

  try {
    const chats = await client.getChats();

    for (const chat of chats) {
      await discoverGroup(chat);
    }

    console.log(`\n=> Đã phát hiện ${knownGroups.size} group`);
    console.log("=> Hệ thống đang lắng nghe mọi tin nhắn mới từ TẤT CẢ các group trên.");
    console.log("=> Khi bạn dùng điện thoại thêm số này vào group mới, hệ thống sẽ tự động phát hiện ngay lập tức!\n");
  } catch (error) {
    console.error("Group scan failed:", error);
  }
});

// 2. Khi có sự kiện tham gia group: Kiểm tra và phát hiện group mới.
client.on("group_join", async notification => {
  try {
    const chat = await notification.getChat();
    await discoverGroup(chat);
  } catch (error) {
    console.error("group_join error:", error.message);
  }
});

// 3. Tự động nhận tin từ MỌI group.
client.on("message_create", async message => {
  try {
    if (readyAt === null) return;

    const chat = await message.getChat();

    // Không lấy tin nhắn riêng.
    if (!chat.isGroup) return;

    // Tự động phát hiện group nếu chưa có.
    await discoverGroup(chat);

    // Không xử lý tin cũ được đồng bộ khi kết nối.
    const sentAt = Number(message.timestamp) * 1000;

    if (!Number.isFinite(sentAt) || sentAt < readyAt) {
      return;
    }

    // Bỏ tin do số giám sát tự gửi.
    if (message.fromMe) return;

    console.log("\n===== NEW MESSAGE =====");
    console.log("Group:", chat.name);
    console.log("Group ID:", chat.id._serialized);
    console.log("Sender:", message.author || message.from);
    console.log("Message:", message.body);
    console.log("Message ID:", message.id?._serialized);
    console.log("Sent at:", new Date(sentAt).toISOString());
    console.log("=======================\n");
  } catch (error) {
    console.error("Message processing error:", error.message);
  }
});

client.on("disconnected", reason => {
  readyAt = null;
  console.error("WhatsApp disconnected:", reason);
});

// Thoát an toàn và đóng sạch Puppeteer Chromium khi bấm Ctrl+C
async function gracefulShutdown() {
  console.log("\n[WhatsApp] Đang đóng Chromium an toàn để giải phóng lockfile...");
  try {
    await client.destroy();
  } catch {}
  process.exit(0);
}

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

// 4. Khởi động WhatsApp.
startWhatsApp().catch(console.error);
