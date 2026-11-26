const express = require("express");

const employeeController = require(
  "../controllers/employee.controller"
);

const router = express.Router();

router.post("/", employeeController.createEmployee);

router.get("/", employeeController.getEmployees);

router.get("/resolve", employeeController.resolveEmployee);

router.get("/:id", employeeController.getEmployeeById);

router.patch(
  "/:id/status",
  employeeController.updateEmployeeStatus
);

module.exports = router;
