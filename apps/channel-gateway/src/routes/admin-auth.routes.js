const express = require("express");
const rateLimit = require("../../../../shared/rate-limit");
const { login, getSession, logout, requireAuthenticatedAdmin } = require("../middlewares/admin-auth.middleware");

const router = express.Router();
router.post("/login", rateLimit({ windowMs: 15 * 60 * 1000, max: 10, name: "admin-login" }), login);
router.get("/session", requireAuthenticatedAdmin, getSession);
router.post("/logout", requireAuthenticatedAdmin, logout);

module.exports = router;
