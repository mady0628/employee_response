const express = require("express");
const controller = require("./whatsapp-internal.controller");
const internalAuth = require("./internal-auth.middleware");

const router = express.Router();
router.use(internalAuth);
router.post("/group-members", controller.getGroupMembers);
router.post("/send-reminder", controller.sendReminder);

module.exports = router;
