const employeeService = require("../services/employee.service");

async function createEmployee(req, res, next) {
  try {
    const employee = await employeeService.createEmployee(
      req.body
    );

    return res.status(201).json({
      success: true,
      data: employee
    });
  } catch (error) {
    next(error);
  }
}

async function getEmployees(req, res, next) {
  try {
    const employees = await employeeService.getEmployees(
      req.query.status
    );

    return res.status(200).json({
      success: true,
      data: employees
    });
  } catch (error) {
    next(error);
  }
}

async function getEmployeeById(req, res, next) {
  try {
    const employee = await employeeService.getEmployeeById(
      req.params.id
    );

    return res.status(200).json({
      success: true,
      data: employee
    });
  } catch (error) {
    next(error);
  }
}

async function updateEmployeeStatus(req, res, next) {
  try {
    const employee = await employeeService.updateEmployeeStatus(
      req.params.id,
      req.body.status
    );

    return res.status(200).json({
      success: true,
      data: employee
    });
  } catch (error) {
    next(error);
  }
}

async function resolveEmployee(req, res, next) {
  try {
    const employee = await employeeService.resolveEmployee(
      req.query.platform,
      req.query.platformUserId
    );

    return res.json({ success: true, data: employee });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createEmployee,
  getEmployees,
  getEmployeeById,
  updateEmployeeStatus,
  resolveEmployee
};
