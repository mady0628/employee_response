const express = require("express");
const controller = require("../controllers/admin.controller");
const internalAuth = require("../middlewares/internal-auth.middleware");

const router = express.Router();
router.use(internalAuth);
router.get("/overview", controller.getOverview);
router.get("/slas", controller.listSlas);
router.get("/reports/daily", controller.getReport);
router.get("/reports/response-time", controller.getResponseTimeReport);
router.get("/settings", controller.getSettings);
router.put("/settings", controller.updateSettings);

module.exports = router;
