const pool = require("../config/database");

// Khóa nhân viên khi tạo mã hoặc xác thực
async function findEmployeeForUpdate(client, employeeId) {
  const result = await client.query(
    `SELECT id, full_name, status
     FROM employees
     WHERE id = $1
     FOR UPDATE`,
    [employeeId]
  );

  return result.rows[0] || null;
}

// Vô hiệu hóa các mã cũ chưa dùng
async function invalidateOldCodes(client, employeeId) {
  await client.query(
    `UPDATE employee_verification_codes
     SET expires_at = NOW()
     WHERE employee_id = $1
       AND used_at IS NULL
       AND expires_at > NOW()`,
    [employeeId]
  );
}

// Tạo mã xác thực mới
async function createCode(client, employeeId, codeHash, expiresAt) {
  const result = await client.query(
    `INSERT INTO employee_verification_codes
       (employee_id, code_hash, expires_at)
     VALUES ($1, $2, $3)
     RETURNING id, employee_id, expires_at`,
    [employeeId, codeHash, expiresAt]
  );

  return result.rows[0];
}

async function createEmployeeFromTelegram(client, fullName) {
  const result = await client.query(
    `INSERT INTO employees (full_name)
     VALUES ($1)
     RETURNING id, full_name, email, status, created_at, updated_at`,
    [fullName]
  );

  return result.rows[0];
}

// Tìm mã theo hash, đồng thời khóa bản ghi
async function findCodeForUpdate(client, codeHash) {
  const result = await client.query(
    `SELECT id, employee_id, expires_at, used_at
     FROM employee_verification_codes
     WHERE code_hash = $1
     FOR UPDATE`,
    [codeHash]
  );

  return result.rows[0] || null;
}

// Liên kết Telegram ID với nhân viên
async function linkTelegramAccount(
  client,
  employeeId,
  telegramUserId,
  telegramUsername = null
) {
  const result = await client.query(
    `INSERT INTO employee_channel_accounts
       (
         employee_id,
         platform,
         platform_user_id,
         telegram_username,
         status,
         verified_at
       )
     VALUES ($1, 'TELEGRAM', $2, $3, 'VERIFIED', NOW())
     ON CONFLICT (employee_id, platform)
     DO UPDATE SET
       platform_user_id = EXCLUDED.platform_user_id,
       telegram_username = EXCLUDED.telegram_username,
       status = 'VERIFIED',
       verified_at = NOW()
     RETURNING
       id,
       employee_id,
       platform,
       platform_user_id,
       telegram_username,
       status,
       verified_at`,
    [employeeId, telegramUserId, telegramUsername]
  );

  return result.rows[0];
}

// Đánh dấu mã đã sử dụng
async function markCodeUsed(client, codeId, employeeId) {
  await client.query(
    `UPDATE employee_verification_codes
     SET used_at = NOW(),
         employee_id = COALESCE(employee_id, $2)
     WHERE id = $1`,
    [codeId, employeeId]
  );
}

// Lấy danh sách nhân viên Telegram đã xác thực
async function getVerifiedTelegramEmployees() {
  const result = await pool.query(
    `SELECT
       e.id AS employee_id,
       e.full_name,
       a.platform_user_id AS telegram_user_id,
       a.verified_at
     FROM employees e
     JOIN employee_channel_accounts a
       ON a.employee_id = e.id
     WHERE e.status = 'ACTIVE'
       AND a.platform = 'TELEGRAM'
       AND a.status = 'VERIFIED'
     ORDER BY e.id`
  );

  return result.rows;
}

module.exports = {
  pool,
  findEmployeeForUpdate,
  invalidateOldCodes,
  createCode,
  createEmployeeFromTelegram,
  findCodeForUpdate,
  linkTelegramAccount,
  markCodeUsed,
  getVerifiedTelegramEmployees
};
