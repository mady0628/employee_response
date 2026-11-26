const express = require("express");
const controller = require("../controllers/verification.controller");
const larkController = require("../controllers/lark-verification.controller");
const larkAccountController = require("../controllers/lark-account.controller");
const whatsappController = require("../controllers/whatsapp-verification.controller");
const whatsappReminderController = require("../controllers/whatsapp-reminder.controller");

const router = express.Router();

router.post("/codes", controller.generateCode);
router.post("/telegram", controller.verifyTelegram);
router.post("/lark", larkController.verify);
router.post("/whatsapp", whatsappController.verify);
router.get("/employees", controller.getVerifiedEmployees);
router.get("/lark/employees", larkAccountController.listVerified);
router.get("/whatsapp/employees", whatsappReminderController.listVerifiedWhatsApp);

module.exports = router;
