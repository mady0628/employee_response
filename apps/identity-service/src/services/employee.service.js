const employeeRepository = require(
  "../repositories/employee.repository"
);
const {
  resolveWhatsAppEmployee
} = require(
  "../repositories/whatsapp-identity.repository"
);

function createError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function validateEmployeeId(id) {
  const value = String(id ?? "");

  if (
    !/^[1-9]\d*$/.test(value) ||
    BigInt(value) > 9223372036854775807n
  ) {
    throw createError(400, "Invalid employee ID");
  }

  return value;
}

async function createEmployee(data) {
  const fullName =
    typeof data?.fullName === "string"
      ? data.fullName.trim()
      : "";

  const email =
    typeof data?.email === "string"
      ? data.email.trim().toLowerCase()
      : null;

  if (!fullName || fullName.length > 150) {
    throw createError(400, "Invalid fullName");
  }

  if (
    email &&
    (email.length > 255 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  ) {
    throw createError(400, "Invalid email");
  }

  return employeeRepository.createEmployee({
    fullName,
    email
  });
}

async function getEmployees(status) {
  if (
    status !== undefined &&
    !["ACTIVE", "INACTIVE"].includes(status)
  ) {
    throw createError(400, "Invalid status filter");
  }

  return employeeRepository.findAll(status || null);
}

async function getEmployeeById(id) {
  const employeeId = validateEmployeeId(id);

  const employee = await employeeRepository.findById(employeeId);

  if (!employee) {
    throw createError(404, "Employee not found");
  }

  return employee;
}

async function updateEmployeeStatus(id, status) {
  const employeeId = validateEmployeeId(id);

  if (!["ACTIVE", "INACTIVE"].includes(status)) {
    throw createError(400, "Invalid employee status");
  }

  const employee = await employeeRepository.updateStatus(
    employeeId,
    status
  );

  if (!employee) {
    throw createError(404, "Employee not found");
  }

  return employee;
}

async function resolveEmployee(platform, platformUserId) {
  if (!platform || !["TELEGRAM", "LARK", "WHATSAPP"].includes(platform)) {
    throw createError(400, "Invalid platform");
  }

  const userIdStr = String(platformUserId ?? "").trim();
  if (!userIdStr) {
    throw createError(400, "Invalid user ID");
  }

  if (platform === "TELEGRAM" && !/^[1-9]\d*$/.test(userIdStr)) {
    throw createError(400, "Invalid user ID");
  }

  if (platform === "WHATSAPP") {
    return resolveWhatsAppEmployee(userIdStr);
  }

  return employeeRepository.findByPlatformAccount(
    platform,
    userIdStr
  );
}

module.exports = {
  createEmployee,
  getEmployees,
  getEmployeeById,
  updateEmployeeStatus,
  resolveEmployee
};
