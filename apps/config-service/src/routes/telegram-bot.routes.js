const express = require("express");
const controller = require("../controllers/telegram-bot.controller");

const router = express.Router();
router.get("/", controller.list);
router.post("/", controller.create);
router.get("/:id/runtime", controller.runtimeCredentials);
router.patch("/:id/status", controller.setStatus);

module.exports = router;
