const pool = require("../config/database");

// Tạo nhân viên
async function createEmployee({ fullName, email }) {
  const result = await pool.query(
    `INSERT INTO employees (full_name, email)
     VALUES ($1, $2)
     RETURNING
       id, full_name, email, status,
       created_at, updated_at`,
    [fullName, email]
  );

  return result.rows[0];
}

// Lấy danh sách nhân viên
async function findAll(status = null) {
  const result = await pool.query(
    `SELECT
       e.id, e.full_name, e.email, e.status,
       e.created_at, e.updated_at,
       COALESCE(accounts.platforms, ARRAY[]::varchar[]) AS linked_platforms
     FROM employees e
     LEFT JOIN LATERAL (
       SELECT array_agg(DISTINCT platform ORDER BY platform) AS platforms
       FROM (
         SELECT platform::varchar AS platform
         FROM employee_channel_accounts
         WHERE employee_id = e.id AND status = 'VERIFIED'
         UNION ALL
         SELECT 'WHATSAPP'::varchar AS platform
         FROM whatsapp_identity_aliases
         WHERE employee_id = e.id AND status = 'VERIFIED'
       ) linked
     ) accounts ON TRUE
     WHERE ($1::VARCHAR IS NULL OR e.status = $1)
     ORDER BY e.id DESC`,
    [status]
  );

  return result.rows;
}

// Lấy nhân viên theo ID
async function findById(id) {
  const result = await pool.query(
    `SELECT
       id, full_name, email, status,
       created_at, updated_at
     FROM employees
     WHERE id = $1`,
    [id]
  );

  return result.rows[0] || null;
}

// Cập nhật trạng thái nhân viên
async function updateStatus(id, status) {
  const result = await pool.query(
    `UPDATE employees
     SET status = $1,
         updated_at = NOW()
     WHERE id = $2
     RETURNING
       id, full_name, email, status,
       created_at, updated_at`,
    [status, id]
  );

  return result.rows[0] || null;
}

// Tìm nhân viên theo tài khoản nền tảng
async function findByPlatformAccount(platform, platformUserId) {
  const result = await pool.query(
    `SELECT e.id, e.full_name, e.status
     FROM employees e
     JOIN employee_channel_accounts a
       ON a.employee_id = e.id
     WHERE a.platform = $1
       AND a.platform_user_id = $2
       AND a.status = 'VERIFIED'
       AND e.status = 'ACTIVE'
     LIMIT 1`,
    [platform, platformUserId]
  );

  return result.rows[0] || null;
}

module.exports = {
  createEmployee,
  findAll,
  findById,
  updateStatus,
  findByPlatformAccount
};
