const express = require("express");
const controller = require("../controllers/telegram-admin.controller");

const router = express.Router();
router.get("/", controller.list);
router.post("/", controller.add);
router.post("/:id/check", controller.check);
router.post("/:id/webhook", controller.configureWebhook);

module.exports = router;
