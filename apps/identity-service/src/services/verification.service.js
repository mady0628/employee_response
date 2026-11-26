const crypto = require("node:crypto");
const repository = require("../repositories/verification.repository");

function createError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function validateEmployeeId(value) {
  const id = String(value ?? "");

  if (
    !/^[1-9]\d*$/.test(id) ||
    BigInt(id) > 9223372036854775807n
  ) {
    throw createError(400, "Invalid employeeId");
  }

  return id;
}

function validateTelegramId(value) {
  const id = String(value ?? "");

  if (!/^[1-9]\d{0,19}$/.test(id)) {
    throw createError(400, "Invalid telegramUserId");
  }

  return id;
}

function hashCode(code) {
  return crypto
    .createHash("sha256")
    .update(code)
    .digest("hex");
}

// API 1: Tạo mã xác thực
async function generateCode(employeeId) {
  const preassigned = employeeId !== undefined && employeeId !== null && employeeId !== "";
  employeeId = preassigned ? validateEmployeeId(employeeId) : null;

  const client = await repository.pool.connect();

  try {
    await client.query("BEGIN");

    if (employeeId) {
      const employee = await repository.findEmployeeForUpdate(
        client,
        employeeId
      );

      if (!employee) {
        throw createError(404, "Employee not found");
      }

      if (employee.status !== "ACTIVE") {
        throw createError(400, "Employee is inactive");
      }
    }

    // Mã ngẫu nhiên 128-bit
    const code = crypto.randomBytes(16).toString("hex");
    const codeHash = hashCode(code);

    // Hết hạn sau 15 phút
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    if (employeeId) {
      await repository.invalidateOldCodes(client, employeeId);
    }

    const savedCode = await repository.createCode(
      client,
      employeeId,
      codeHash,
      expiresAt
    );

    await client.query("COMMIT");

    return {
      employeeId: savedCode.employee_id,
      code,
      expiresAt: savedCode.expires_at
    };

  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// API 2: Xác thực Telegram ID (với thứ tự khóa tránh deadlock)
async function verifyTelegram(code, telegramUser) {
  if (typeof code !== "string" || !/^[a-f0-9]{32}$/.test(code)) {
    throw createError(400, "Invalid verification code");
  }

  const telegramUserId = validateTelegramId(telegramUser?.id);
  const firstName = String(telegramUser?.first_name ?? "").trim();
  const lastName = String(telegramUser?.last_name ?? "").trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ").slice(0, 150);
  const telegramUsername = typeof telegramUser?.username === "string"
    ? telegramUser.username.trim().slice(0, 255) || null
    : null;

  if (!fullName) {
    throw createError(400, "Telegram profile has no first name");
  }

  const client = await repository.pool.connect();

  try {
    await client.query("BEGIN");

    const codeHash = hashCode(code);

    // Đọc employee_id trước, chưa khóa code
    const lookup = await client.query(
      `SELECT employee_id
       FROM employee_verification_codes
       WHERE code_hash = $1`,
      [codeHash]
    );

    if (lookup.rowCount === 0) {
      throw createError(400, "Code is invalid or expired");
    }

    // Mã cũ có thể đã gắn với employee; mã onboarding mới thì chưa.
    let employee = null;
    if (lookup.rows[0].employee_id !== null) {
      employee = await repository.findEmployeeForUpdate(
        client,
        lookup.rows[0].employee_id
      );

      if (!employee || employee.status !== "ACTIVE") {
        throw createError(400, "Employee is inactive");
      }
    }

    // 2. Khóa code và đọc lại trạng thái
    const verification = await repository.findCodeForUpdate(
      client,
      codeHash
    );

    if (!verification || verification.used_at !== null) {
      throw createError(400, "Code is invalid or expired");
    }

    const validity = await client.query(
      `SELECT 1
       FROM employee_verification_codes
       WHERE id = $1
         AND used_at IS NULL
         AND expires_at > clock_timestamp()`,
      [verification.id]
    );

    if (validity.rowCount === 0) {
      throw createError(400, "Code is invalid or expired");
    }

    // Mã onboarding tạo employee từ tên hồ sơ Telegram trong cùng transaction.
    if (!employee) {
      employee = await repository.createEmployeeFromTelegram(
        client,
        fullName
      );
    }

    // Liên kết Telegram ID
    const account = await repository.linkTelegramAccount(
      client,
      employee.id,
      telegramUserId,
      telegramUsername
    );

    // 4. Đánh dấu mã đã sử dụng
    await repository.markCodeUsed(client, verification.id, employee.id);

    await client.query("COMMIT");

    return account;
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      throw createError(
        409,
        "Telegram ID already belongs to another employee"
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

// API 3: Lấy Sales đã xác thực
async function getVerifiedEmployees() {
  return repository.getVerifiedTelegramEmployees();
}

module.exports = {
  generateCode,
  verifyTelegram,
  getVerifiedEmployees
};
