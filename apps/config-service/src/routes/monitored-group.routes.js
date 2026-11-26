const express = require("express");
const controller = require("../controllers/monitored-group.controller");

const router = express.Router();

router.post("/discover", controller.discoverGroup);
router.get("/", controller.listGroups);
router.get("/:connectionId/:groupId", controller.getGroup);

module.exports = router;
