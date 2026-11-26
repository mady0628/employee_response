const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });
require("dotenv").config();
require("../../../shared/logger");
require("../../../shared/fatal-process-handlers")("reminder-service");
require("../../../shared/validate-production-env")([
  "DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD", "IDENTITY_INTERNAL_API_KEY", "GATEWAY_INTERNAL_API_KEY",
  "IDENTITY_SERVICE_URL", "GATEWAY_SERVICE_URL"
]);

const app = require("./app");
const pool = require("./config/database");
require("../../../shared/database-readiness")(app, pool);
app.use((req, res) => res.status(404).json({ success: false, message: "Route not found" }));
const { initDatabase } = require("./config/init-db");
const { startReminderWorker } = require("./workers/reminder.worker");

const PORT = Number(process.env.PORT || 3006);

async function start() {
  try {
    await pool.query("SELECT 1");
    console.log("Reminder database connected");

    await initDatabase();
    startReminderWorker();

    app.listen(PORT, process.env.HOST || "0.0.0.0", () => {
      console.log("Reminder Service listening", { port: PORT });
    });
  } catch (error) {
    console.error(
      "Reminder Service startup failed:",
      error.message
    );
    process.exit(1);
  }
}

start();
