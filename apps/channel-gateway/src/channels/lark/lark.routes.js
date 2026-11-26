const express = require("express");
const { handleLarkWebhook } = require("./lark.controller");

const router = express.Router();

router.post("/", handleLarkWebhook);

module.exports = router;
