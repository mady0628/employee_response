const crypto = require("node:crypto");
const pool = require("../config/database");

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function hashCode(code) {
  return crypto
    .createHash("sha256")
    .update(code)
    .digest("hex");
}

async function verifyWhatsAppEmployee(code, whatsappUserId) {
  if (
    typeof code !== "string" ||
    !/^[a-fA-F0-9]{32}$/.test(code) ||
    typeof whatsappUserId !== "string" ||
    !/^[A-Za-z0-9._-]+@(c\.us|lid)$/.test(whatsappUserId)
  ) {
    throw httpError("Invalid verification request", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock the code first; employee_id may be NULL for self-onboarding codes.
    const codeResult = await client.query(
      `SELECT id, employee_id, expires_at, used_at
       FROM employee_verification_codes
       WHERE code_hash = $1
       FOR UPDATE`,
      [hashCode(code)]
    );

    if (!codeResult.rowCount) {
      throw httpError(
        "Invalid or expired verification code",
        400
      );
    }

    const record = codeResult.rows[0];
    if (
      record.used_at !== null ||
      new Date(record.expires_at) <= new Date()
    ) {
      throw httpError(
        "Invalid or expired verification code",
        400
      );
    }

    let employee = null;
    if (record.employee_id !== null) {
      const employeeResult = await client.query(
        `SELECT id, full_name, email, status
         FROM employees
         WHERE id = $1
         FOR UPDATE`,
        [record.employee_id]
      );
      employee = employeeResult.rows[0] || null;

      if (!employee || employee.status !== "ACTIVE") {
        throw httpError("Employee inactive", 403);
      }
    }

    // Reuse an existing account's employee for an unassigned one-time code.
    const owner = await client.query(
      `SELECT employee_id
       FROM employee_channel_accounts
       WHERE platform = 'WHATSAPP'
         AND platform_user_id = $1
       FOR UPDATE`,
      [whatsappUserId]
    );

    if (owner.rowCount) {
      if (
        employee &&
        String(owner.rows[0].employee_id) !== String(employee.id)
      ) {
        throw httpError(
          "WhatsApp account already belongs to another employee",
          409
        );
      }

      if (!employee) {
        const ownerEmployee = await client.query(
          `SELECT id, full_name, email, status
           FROM employees
           WHERE id = $1
           FOR UPDATE`,
          [owner.rows[0].employee_id]
        );
        employee = ownerEmployee.rows[0] || null;

        if (!employee || employee.status !== "ACTIVE") {
          throw httpError("Employee inactive", 403);
        }
      }
    }

    if (!employee) {
      const inserted = await client.query(
        `INSERT INTO employees (full_name)
         VALUES (NULL)
         RETURNING id, full_name, email, status`,
        []
      );
      employee = inserted.rows[0];
    }

    await client.query(
      `INSERT INTO employee_channel_accounts (
         employee_id,
         platform,
         platform_user_id,
         status,
         verified_at
       )
       VALUES ($1, 'WHATSAPP', $2, 'VERIFIED', NOW())
       ON CONFLICT (employee_id, platform)
       DO UPDATE SET
         platform_user_id = EXCLUDED.platform_user_id,
         status = 'VERIFIED',
         verified_at = NOW()`,
      [employee.id, whatsappUserId]
    );

    await client.query(
      `UPDATE employee_verification_codes
       SET used_at = NOW(),
           employee_id = COALESCE(employee_id, $2)
       WHERE id = $1`,
      [record.id, employee.id]
    );

    await client.query("COMMIT");

    return {
      employeeId: String(employee.id),
      fullName: employee.full_name,
      platform: "WHATSAPP",
      platformUserId: whatsappUserId
    };
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      throw httpError(
        "WhatsApp account mapping conflict",
        409
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  verifyWhatsAppEmployee
};
