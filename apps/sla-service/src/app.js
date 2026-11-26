const express = require("express");
const helmet = require("helmet");
const adminRoutes = require("./routes/admin.routes");

const app = express();
const rateLimit = require("../../../shared/rate-limit");
require("../../../shared/trust-proxy")(app);

app.use(helmet());
app.use("/api", rateLimit({ max: Number(process.env.API_RATE_LIMIT || 120) }));
app.use("/internal", rateLimit({ max: Number(process.env.INTERNAL_RATE_LIMIT || 120), name: "internal" }));
app.use(express.json({ limit: "100kb" }));
app.use("/internal/admin", adminRoutes);

app.get("/health", (req, res) => {
  res.json({
    service: "sla-service",
    status: "UP"
  });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error("SLA service request failed:", error);
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 500 ? error.status : 500;
  return res.status(status).json({ success: false, message: status < 500 ? error.message : "Internal server error" });
});

module.exports = app;
