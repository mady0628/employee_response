const express = require("express");
const controller = require("../controllers/admin-operations.controller");
const { requireAuthenticatedAdmin } = require("../middlewares/admin-auth.middleware");

const router = express.Router();
router.use(requireAuthenticatedAdmin);
router.get("/employees", controller.listEmployees);
router.post("/employees", controller.createEmployee);
router.patch("/employees/:id/status", controller.updateEmployeeStatus);
router.post("/employees/:id/verification-code", controller.generateVerificationCode);
router.post("/verification-codes", controller.generateOnboardingVerificationCode);
router.get("/groups", controller.listGroups);
router.patch("/groups/:id/status", controller.setGroupStatus);
router.get("/conversations", controller.listConversations);
router.get("/overview", controller.getOverview);
router.get("/slas", controller.listSlas);
router.get("/reports/daily", controller.getReport);
router.get("/reports/response-time", controller.getResponseTimeReport);
router.get("/settings", controller.getSettings);
router.put("/settings", controller.updateSettings);

module.exports = router;
