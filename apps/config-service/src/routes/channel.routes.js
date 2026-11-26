const express = require("express");
const controller = require("../controllers/channel.controller");

const router = express.Router();

router.post("/", controller.createChannel);
router.get("/", controller.getChannels);
router.get("/:id", controller.getChannelById);

module.exports = router;
