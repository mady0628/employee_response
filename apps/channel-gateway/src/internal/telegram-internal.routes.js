const express = require("express");
const controller = require("./telegram-internal.controller");
const internalAuth = require("./internal-auth.middleware");

const router = express.Router();

router.use(internalAuth);

router.post("/chat-member", controller.getChatMember);
router.post("/send-message", controller.sendMessage);

module.exports = router;
