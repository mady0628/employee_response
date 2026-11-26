const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });
require("dotenv").config();
require("../../../shared/logger");
require("../../../shared/fatal-process-handlers")("config-service");
require("../../../shared/validate-production-env")([
  "DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD", "CONFIG_INTERNAL_API_KEY",
  "TELEGRAM_CREDENTIALS_ENCRYPTION_KEY"
]);

const app = require("./app");
const pool = require("./config/database");
require("../../../shared/database-readiness")(app, pool);
app.use((req, res) => res.status(404).json({ success: false, message: "Route not found" }));
const { initDatabase } = require("./config/init-db");

const PORT = Number(process.env.PORT || 3002);

async function startServer() {
  try {
    await pool.query("SELECT 1");
    console.log("Config database connected");

    // Tự động kiểm tra và tạo bảng, index nếu chưa tồn tại
    await initDatabase();

    app.listen(PORT, process.env.HOST || "0.0.0.0", () => {
      console.log("Config Service listening", { port: PORT });
    });
  } catch (error) {
    console.error("Startup error:", error.message);
    process.exit(1);
  }
}

startServer();
