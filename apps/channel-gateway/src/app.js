const express = require("express");
const helmet = require("helmet");
const telegramRoutes = require(
  "./channels/telegram/telegram.routes"
);
const larkWebhook = require(
  "./channels/lark/lark.webhook"
);
const telegramInternalRoutes = require(
  "./internal/telegram-internal.routes"
);
const larkInternalRoutes = require(
  "./internal/lark-internal.routes"
);
const whatsappInternalRoutes = require("./internal/whatsapp-internal.routes");
const adminConnectionController = require(
  "./controllers/admin-connection.controller"
);
const whatsappAdminRoutes = require(
  "./routes/whatsapp-admin.routes"
);
const telegramAdminRoutes = require("./routes/telegram-admin.routes");
const adminOperationsRoutes = require("./routes/admin-operations.routes");
const adminAuthRoutes = require("./routes/admin-auth.routes");
const {
  requireAuthenticatedAdmin
} = require("./middlewares/admin-auth.middleware");

const app = express();
const rateLimit = require("../../../shared/rate-limit");
require("../../../shared/trust-proxy")(app);

app.use(helmet());
app.use("/webhooks", rateLimit({ max: Number(process.env.WEBHOOK_RATE_LIMIT || 600), name: "webhook" }));
app.use("/internal", rateLimit({ max: Number(process.env.INTERNAL_RATE_LIMIT || 120), name: "internal" }));
app.use("/api/admin", rateLimit({ max: Number(process.env.ADMIN_API_RATE_LIMIT || 120), name: "admin-api" }));
app.use(express.json({ limit: "256kb" }));

app.get("/health", (req, res) => {
  return res.json({
    service: "channel-gateway",
    status: "UP"
  });
});

app.use("/webhooks/telegram", telegramRoutes);
app.post("/webhooks/lark", larkWebhook);
app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/admin/ops", adminOperationsRoutes);
app.use("/internal/telegram", telegramInternalRoutes);
app.use("/internal/lark", larkInternalRoutes);
app.use("/internal/whatsapp", whatsappInternalRoutes);
app.get(
  "/api/admin/connections",
  requireAuthenticatedAdmin,
  adminConnectionController.listConnections
);
app.use(
  "/api/admin/connections/telegram",
  requireAuthenticatedAdmin,
  telegramAdminRoutes
);
app.use(
  "/api/admin/connections",
  requireAuthenticatedAdmin,
  whatsappAdminRoutes
);

app.use((err, req, res, next) => {
  console.error("Gateway error:", err.message);
  if (res.headersSent) {
    return next(err);
  }
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 500
    ? err.status
    : 500;
  return res.status(status).json({
    success: false,
    message: status < 500 ? err.message : "Internal server error"
  });
});

module.exports = app;
