const express = require("express");
const controller = require("../controllers/admin-connection.controller");

const router = express.Router();

router.get("/", controller.getAll);
router.get("/runnable/whatsapp", controller.getRunnableWhatsApp);
router.post("/whatsapp", controller.createWhatsApp);
router.patch("/:id/desired-state", controller.setDesiredState);
router.get("/:id", controller.getOne);
router.patch("/:id/toggle", controller.toggleEnabled);

module.exports = router;
