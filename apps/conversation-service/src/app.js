const express = require("express");
const helmet = require("helmet");
const conversationRoutes = require("./routes/conversation.routes");

const app = express();
const rateLimit = require("../../../shared/rate-limit");
require("../../../shared/trust-proxy")(app);

app.use(helmet());
app.use("/api", rateLimit({ max: Number(process.env.API_RATE_LIMIT || 120) }));
app.use(express.json({ limit: "100kb" }));
app.use("/api/conversations", conversationRoutes);

app.get("/health", (req, res) => {
  res.json({
    service: "conversation-service",
    status: "UP"
  });
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error("Conversation service request failed:", err);
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 500
    ? err.status
    : 500;
  return res.status(status).json({
    success: false,
    message: status === 500 ? "Internal server error" : err.message
  });
});

module.exports = app;
