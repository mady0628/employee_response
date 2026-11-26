const express = require("express");
const controller = require("../controllers/whatsapp-admin.controller");

const router = express.Router();

router.post("/whatsapp", controller.create);
router.patch("/:id/desired-state", controller.updateDesiredState);
router.post("/:id/start", controller.start);
router.get("/:id/runtime", controller.runtime);
router.post("/:id/stop", controller.stop);
router.post("/:id/logout", controller.logout);

module.exports = router;
