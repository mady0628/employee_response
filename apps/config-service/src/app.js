const express = require("express");
const helmet = require("helmet");

const channelRoutes = require("./routes/channel.routes");
const monitoredGroupRoutes = require("./routes/monitored-group.routes");
const adminConnectionRoutes = require("./routes/admin-connection.routes");
const telegramBotRoutes = require("./routes/telegram-bot.routes");
const connectionRuntimeController = require("./controllers/connection-runtime.controller");
const internalAuth = require("./middlewares/internal-auth.middleware");
const errorMiddleware = require("./middlewares/error.middleware");

const app = express();
const rateLimit = require("../../../shared/rate-limit");
require("../../../shared/trust-proxy")(app);

app.use(helmet());
app.use("/api", rateLimit({ max: Number(process.env.INTERNAL_RATE_LIMIT || 120) }));
app.use("/internal", rateLimit({ max: Number(process.env.INTERNAL_RATE_LIMIT || 120), name: "internal" }));
app.use(express.json({ limit: "100kb" }));

app.get("/health", (req, res) => {
  res.json({
    success: true,
    service: "config-service",
    status: "UP"
  });
});

app.use("/api/channels", internalAuth, channelRoutes);
app.use("/internal/monitored-groups", internalAuth, monitoredGroupRoutes);
app.use("/internal/admin/connections", internalAuth, adminConnectionRoutes);
app.use("/internal/admin/telegram-bots", internalAuth, telegramBotRoutes);
app.use("/internal/telegram-bots", internalAuth, telegramBotRoutes);
app.post(
  "/internal/connections/:id/claim-runtime",
  internalAuth,
  connectionRuntimeController.claim
);
app.patch(
  "/internal/connections/:id/runtime",
  internalAuth,
  connectionRuntimeController.update
);
app.patch(
  "/internal/connections/:id/runtime/heartbeat",
  internalAuth,
  connectionRuntimeController.heartbeat
);

app.use(errorMiddleware);

module.exports = app;
