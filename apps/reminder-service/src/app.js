const express = require("express");
const helmet = require("helmet");

const app = express();
const rateLimit = require("../../../shared/rate-limit");
require("../../../shared/trust-proxy")(app);

app.use(helmet());
app.use("/api", rateLimit({ max: Number(process.env.API_RATE_LIMIT || 120) }));
app.use(express.json({ limit: "100kb" }));

app.get("/health", (req, res) => {
  res.json({
    success: true,
    service: "reminder-service",
    status: "UP"
  });
});

module.exports = app;
