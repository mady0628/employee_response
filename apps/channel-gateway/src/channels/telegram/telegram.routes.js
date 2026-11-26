const express = require("express");
const controller = require("./telegram.controller");
const verifyTelegramWebhook = require("./telegram.verify");
const verifyTelegramBotWebhook = require("./telegram-bot.verify");

const router = express.Router();

router.post(
  "/",
  verifyTelegramWebhook,
  controller.receiveWebhook
);
router.post(
  "/:connectionId",
  verifyTelegramBotWebhook,
  controller.receiveWebhook
);

module.exports = router;
