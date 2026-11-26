const pool = require("../config/database");

async function resolveWhatsAppEmployee(platformUserId) {
  const result = await pool.query(
    `SELECT
       e.id,
       e.full_name,
       e.status
     FROM employees e
     WHERE e.status = 'ACTIVE'
       AND (
         EXISTS (
           SELECT 1
           FROM employee_channel_accounts a
           WHERE a.employee_id = e.id
             AND a.platform = 'WHATSAPP'
             AND a.platform_user_id = $1
             AND a.status = 'VERIFIED'
         )
         OR EXISTS (
           SELECT 1
           FROM whatsapp_identity_aliases a
           WHERE a.employee_id = e.id
             AND a.platform_user_id = $1
             AND a.status = 'VERIFIED'
         )
       )
     LIMIT 2`,
    [platformUserId]
  );

  if (result.rowCount > 1) {
    throw new Error(
      "WhatsApp identity resolves to multiple employees"
    );
  }

  return result.rows[0] || null;
}

module.exports = {
  resolveWhatsAppEmployee
};
