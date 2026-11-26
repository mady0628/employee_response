const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });
require("dotenv").config();
require("../../../shared/logger");
require("../../../shared/fatal-process-handlers")("conversation-service");
require("../../../shared/validate-production-env")([
  "DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD", "RABBITMQ_PASSWORD", "RABBITMQ_URL",
  "IDENTITY_INTERNAL_API_KEY", "CONVERSATION_ADMIN_API_KEY", "IDENTITY_SERVICE_URL"
]);

const app = require("./app");
const pool = require("./config/database");
require("../../../shared/database-readiness")(app, pool);
app.use((req, res) => res.status(404).json({ success: false, message: "Route not found" }));
const { initDatabase } = require("./config/init-db");
const { startTelegramConsumer } = require("./consumers/telegram.consumer");
const { startLarkConsumer } = require("./consumers/lark.consumer");
const { startReactionConsumer } = require("./consumers/reaction.consumer");
const { startLarkReactionConsumer } = require("./consumers/lark-reaction.consumer");
const { startWhatsAppConsumer } = require("./consumers/whatsapp.consumer");
const { startWhatsAppReactionConsumer } = require("./consumers/whatsapp-reaction.consumer");
const { connectPublisher, startOutboxWorker } = require("./publishers/outbox.publisher");

const PORT = Number(process.env.PORT || 3004);

async function start() {
  try {
    await pool.query("SELECT 1");
    console.log("Conversation DB connected");

    // Tự động kiểm tra và khởi tạo schema DB
    await initDatabase();

    await connectPublisher();
    await startTelegramConsumer();
    await startLarkConsumer();
    await startReactionConsumer();
    await startLarkReactionConsumer();
    await startWhatsAppConsumer();
    await startWhatsAppReactionConsumer();
    startOutboxWorker();

    app.listen(PORT, process.env.HOST || "0.0.0.0", () => {
      console.log("Conversation Service listening", { port: PORT });
    });
  } catch (error) {
    console.error("Conversation startup failed:", error.message);
    process.exit(1);
  }
}

start();
