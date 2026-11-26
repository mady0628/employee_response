const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });
require("dotenv").config();
require("../../../shared/logger");
require("../../../shared/fatal-process-handlers")("sla-service");
require("../../../shared/validate-production-env")([
  "DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD", "RABBITMQ_PASSWORD", "RABBITMQ_URL", "GATEWAY_INTERNAL_API_KEY"
]);

const app = require("./app");
const pool = require("./config/database");
require("../../../shared/database-readiness")(app, pool);
app.use((req, res) => res.status(404).json({ success: false, message: "Route not found" }));
const { initDatabase } = require("./config/init-db");
const { startConversationConsumer } = require("./consumers/conversation.consumer");
const { startLarkConsumer } = require("./consumers/lark.consumer");
const { startWhatsAppConsumer } = require("./consumers/whatsapp.consumer");
const { startInboxWorker } = require("./workers/inbox.worker");
const { startLarkInboxWorker } = require("./workers/lark-inbox.worker");
const { startWhatsAppInboxWorker } = require("./workers/whatsapp-inbox.worker");
const { startSlaWorker } = require("./workers/sla.worker");
const { startReactionWorker } = require("./workers/reaction.worker");
const { startLarkReactionWorker } = require("./workers/lark-reaction.worker");
const { startWhatsAppReactionWorker } = require("./workers/whatsapp-reaction.worker");
const slaRepository = require("./repositories/sla.repository");

const PORT = Number(process.env.PORT || 3005);

async function start() {
  try {
    await pool.query("SELECT 1");
    console.log("SLA Database connected");

    // Tự động kiểm tra và khởi tạo schema SLA & Reminder
    await initDatabase();
    await slaRepository.rescheduleWaitingSlas();

    await startConversationConsumer();
    await startLarkConsumer();
    await startWhatsAppConsumer();
    startInboxWorker();
    startLarkInboxWorker();
    startWhatsAppInboxWorker();
    startSlaWorker();
    startReactionWorker();
    startLarkReactionWorker();
    startWhatsAppReactionWorker();

    app.listen(PORT, process.env.HOST || "0.0.0.0", () => {
      console.log("SLA Service listening", { port: PORT });
    });
  } catch (error) {
    console.error("SLA startup failed:", error);
    process.exit(1);
  }
}

start();
