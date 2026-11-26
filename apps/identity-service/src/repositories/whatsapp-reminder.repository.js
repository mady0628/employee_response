const pool = require("../config/database");

async function getVerifiedWhatsAppEmployees() {
  const result = await pool.query(
    `WITH verified_ids AS (
       SELECT
         e.id AS employee_id,
         e.full_name,
         a.platform_user_id
       FROM employees e
       JOIN employee_channel_accounts a
         ON a.employee_id = e.id
       WHERE e.status = 'ACTIVE'
         AND a.platform = 'WHATSAPP'
         AND a.status = 'VERIFIED'

       UNION

       SELECT
         e.id AS employee_id,
         e.full_name,
         a.platform_user_id
       FROM employees e
       JOIN whatsapp_identity_aliases a
         ON a.employee_id = e.id
       WHERE e.status = 'ACTIVE'
         AND a.status = 'VERIFIED'
     )
     SELECT
       employee_id,
       full_name,
       ARRAY_AGG(
         DISTINCT platform_user_id
       ) AS platform_user_ids
     FROM verified_ids
     GROUP BY employee_id, full_name
     ORDER BY employee_id`
  );

  return result.rows.map(row => ({
    employeeId: String(row.employee_id),
    fullName: row.full_name,
    platformUserIds: row.platform_user_ids
  }));
}

module.exports = {
  getVerifiedWhatsAppEmployees
};
