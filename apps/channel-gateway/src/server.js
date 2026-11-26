const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });
require("dotenv").config();
require("../../../shared/logger");
require("../../../shared/fatal-process-handlers")("channel-gateway");
require("../../../shared/validate-production-env")([
  "RABBITMQ_PASSWORD", "RABBITMQ_URL", "IDENTITY_INTERNAL_API_KEY", "CONFIG_INTERNAL_API_KEY", "GATEWAY_INTERNAL_API_KEY", "CONVERSATION_ADMIN_API_KEY",
  "IDENTITY_SERVICE_URL", "CONFIG_SERVICE_URL", "CONVERSATION_SERVICE_URL", "SLA_SERVICE_URL",
  "LARK_APP_ID", "LARK_APP_SECRET", "LARK_VERIFICATION_TOKEN",
  "ADMIN_DASHBOARD_USERNAME", "ADMIN_DASHBOARD_PASSWORD", "ADMIN_DASHBOARD_SESSION_SECRET"
]);

const app = require("./app");
const { validateTelegramConfig } = require("./config/telegram.config");
const { connectRabbitMQ } = require("./publishers/telegram.publisher");
const { connectReactionPublisher } = require("./publishers/reaction.publisher");
const { connectLarkPublisher } = require("./publishers/lark.publisher");
const { connectWhatsAppPublisher } = require("./publishers/whatsapp.publisher");
const telegramPublisher = require("./publishers/telegram.publisher");
const reactionPublisher = require("./publishers/reaction.publisher");
const larkPublisher = require("./publishers/lark.publisher");
const whatsappPublisher = require("./publishers/whatsapp.publisher");
const telegramClient = require("./channels/telegram/telegram.client");
const configClient = require("./clients/config.client");
const { manager } = require("./services/whatsapp-session.service");
const { restoreWhatsAppSessions } = require("./services/whatsapp-recovery.service");

const PORT = Number(process.env.PORT || 3003);

async function start() {
  try {
    const hasLegacyTelegramBot = validateTelegramConfig();
    await connectRabbitMQ();
    await connectReactionPublisher();
    await connectLarkPublisher();
    await connectWhatsAppPublisher();

    app.get("/ready", (req, res) => {
      const dependencies = {
        telegramPublisher: telegramPublisher.isReady(),
        reactionPublisher: reactionPublisher.isReady(),
        larkPublisher: larkPublisher.isReady(),
        whatsappPublisher: whatsappPublisher.isReady()
      };
      const ready = Object.values(dependencies).every(Boolean);
      return res.status(ready ? 200 : 503).json({
        status: ready ? "READY" : "NOT_READY",
        dependencies
      });
    });
    app.use((req, res) => res.status(404).json({ success: false, message: "Route not found" }));

    app.listen(PORT, process.env.HOST || "0.0.0.0", async () => {
      console.log("Channel Gateway listening", { port: PORT });

      try {
        if (hasLegacyTelegramBot) {
          const legacyBot = await telegramClient.getBotInfo();
          let managedBots = [];
          try {
            managedBots = await configClient.getTelegramBots();
          } catch (error) {
            console.warn("Could not check dashboard-managed Telegram bots:", error.message);
          }
          const isManaged = managedBots.some(bot => String(bot.bot_id) === String(legacyBot.id));
          if (isManaged) {
            console.log("Telegram bot is managed from the admin dashboard; keeping its per-bot webhook");
          } else {
            await telegramClient.setupWebhook();
          }
        } else {
          console.log("No legacy Telegram bot configured; use the admin dashboard to add bots");
        }
      } catch (error) {
        console.error("Telegram webhook setup failed:", error.message);
      }

      // Bước 5.5: Tự động khôi phục các phiên WhatsApp đang RUNNING
      try {
        await restoreWhatsAppSessions();
      } catch (err) {
        console.warn("[Channel Gateway] autoRestoreWhatsAppSessions:", err.message);
      }
    });

    async function gracefulShutdown() {
      console.log("\n[Channel Gateway] Đang dọn dẹp các phiên trình duyệt WhatsApp...");
      for (const id of manager.sessions.keys()) {
        try {
          await manager.stop(id);
        } catch (error) {
          console.error(`[Channel Gateway] Cleanup failed for session #${id}:`, error.message);
        }
      }
      process.exit(0);
    }

    process.on("SIGINT", gracefulShutdown);
    process.on("SIGTERM", gracefulShutdown);
  } catch (error) {
    console.error("Gateway startup failed:", error.message);
    process.exit(1);
  }
}

start();
