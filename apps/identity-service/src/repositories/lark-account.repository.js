const pool = require("../config/database");

async function getVerifiedLarkEmployees() {
  const result = await pool.query(
    `SELECT
       e.id AS employee_id,
       e.full_name,
       a.platform_user_id AS lark_open_id

     FROM employees e

     JOIN employee_channel_accounts a
       ON a.employee_id = e.id

     WHERE e.status = 'ACTIVE'
       AND a.platform = 'LARK'
       AND a.status = 'VERIFIED'

     ORDER BY e.id`
  );

  return result.rows.map(row => ({
    employeeId: String(row.employee_id),
    fullName: row.full_name,
    larkOpenId: row.lark_open_id
  }));
}

module.exports = {
  getVerifiedLarkEmployees
};
