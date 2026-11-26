const express = require("express");
const controller = require("../controllers/conversation.controller");
const conversationAdminAuth = require("../middlewares/conversation-admin-auth");

const router = express.Router();

router.use(conversationAdminAuth);
router.get("/", controller.listConversations);
router.patch("/monitored-groups/:id/status", controller.setMonitoredGroupStatus);
router.patch("/:id/reading", controller.setReadingEnabled);

module.exports = router;
