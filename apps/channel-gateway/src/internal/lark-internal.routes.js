const express = require("express");

const controller = require(
  "./lark-internal.controller"
);

const internalAuth = require(
  "./internal-auth.middleware"
);

const router = express.Router();

router.use(internalAuth);

router.post(
  "/group-members",
  controller.getMembers
);

router.post(
  "/send-message",
  controller.sendMessage
);

module.exports = router;
