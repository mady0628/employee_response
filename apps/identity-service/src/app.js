const express = require("express");
const helmet = require("helmet");

const employeeRoutes = require("./routes/employee.routes");
const verificationRoutes = require("./routes/verification.routes");

const internalAuth = require("./middlewares/internal-auth.middleware");
const errorMiddleware = require("./middlewares/error.middleware");

const app = express();
const rateLimit = require("../../../shared/rate-limit");
require("../../../shared/trust-proxy")(app);

app.use(helmet());
app.use("/api", rateLimit({ max: Number(process.env.API_RATE_LIMIT || 120) }));
app.use("/api/verifications/codes", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.VERIFICATION_CODE_RATE_LIMIT || 100),
  name: "verification-codes"
}));
app.use(express.json({ limit: "100kb" }));

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    service: "identity-service",
    status: "UP"
  });
});

// API nội bộ phải có API key
app.use("/api/employees", internalAuth, employeeRoutes);

app.use(
  "/api/verifications",
  internalAuth,
  verificationRoutes
);

app.use(errorMiddleware);

module.exports = app;
