const crypto = require("node:crypto");
const pool = require("../config/database");

function createHttpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function verifyLarkEmployee(code, larkOpenId, profile = {}) {
  const fullName = typeof profile.fullName === "string"
    ? profile.fullName.trim().slice(0, 150) || null
    : null;
  const normalizedEmail = typeof profile.email === "string"
    ? profile.email.trim().toLowerCase()
    : "";
  const email = normalizedEmail || null;

  if (
    typeof code !== "string" ||
    !/^[a-fA-F0-9]{32}$/.test(code) ||
    typeof larkOpenId !== "string" ||
    !/^ou_[A-Za-z0-9_-]+$/.test(larkOpenId) ||
    (email && (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))
  ) {
    throw createHttpError("Invalid verification request", 400);
  }

  const codeHash = crypto
    .createHash("sha256")
    .update(code)
    .digest("hex");

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Read employee_id first so employee and code locks follow a stable order.
    const lookup = await client.query(
      `SELECT employee_id
       FROM employee_verification_codes
       WHERE code_hash = $1`,
      [codeHash]
    );

    if (lookup.rowCount === 0) {
      throw createHttpError("Invalid or expired code", 400);
    }

    let employee = null;
    if (lookup.rows[0].employee_id !== null) {
      const employeeResult = await client.query(
        `SELECT id, full_name, email, status
         FROM employees
         WHERE id = $1
         FOR UPDATE`,
        [lookup.rows[0].employee_id]
      );

      employee = employeeResult.rows[0] || null;
      if (!employee || employee.status !== "ACTIVE") {
        throw createHttpError("Employee is inactive", 403);
      }
    }

    // Lock and validate the code after any preassigned employee lock.
    const codeResult = await client.query(
      `SELECT id, employee_id, expires_at, used_at
       FROM employee_verification_codes
       WHERE code_hash = $1
       FOR UPDATE`,
      [codeHash]
    );
    const verification = codeResult.rows[0];

    if (
      !verification ||
      verification.used_at !== null ||
      new Date(verification.expires_at) <= new Date()
    ) {
      throw createHttpError("Invalid or expired code", 400);
    }

    const existingOwner = await client.query(
      `SELECT employee_id
       FROM employee_channel_accounts
       WHERE platform = 'LARK'
         AND platform_user_id = $1`,
      [larkOpenId]
    );

    if (
      existingOwner.rowCount > 0 &&
      (!employee || String(existingOwner.rows[0].employee_id) !== String(employee.id))
    ) {
      throw createHttpError("Lark account belongs to another employee", 409);
    }

    if (!employee) {
      if (email) {
        const emailMatch = await client.query(
          `SELECT id, full_name, email, status
           FROM employees
           WHERE lower(email) = $1
           FOR UPDATE`,
          [email]
        );
        employee = emailMatch.rows[0] || null;

        if (employee && employee.status !== "ACTIVE") {
          throw createHttpError("Employee is inactive", 403);
        }
      }

      if (!employee) {
        const inserted = await client.query(
          `INSERT INTO employees (full_name, email)
           VALUES ($1, $2)
           RETURNING id, full_name, email, status`,
          [fullName, email]
        );
        employee = inserted.rows[0];
      }
    }

    await client.query(
      `INSERT INTO employee_channel_accounts (
         employee_id,
         platform,
         platform_user_id,
         status,
         verified_at
       )
       VALUES ($1, 'LARK', $2, 'VERIFIED', NOW())
       ON CONFLICT (employee_id, platform)
       DO UPDATE SET
         platform_user_id = EXCLUDED.platform_user_id,
         status = 'VERIFIED',
         verified_at = NOW()`,
      [employee.id, larkOpenId]
    );

    await client.query(
      `UPDATE employee_verification_codes
       SET used_at = NOW(),
           employee_id = COALESCE(employee_id, $2)
       WHERE id = $1`,
      [verification.id, employee.id]
    );

    await client.query("COMMIT");

    return {
      employeeId: String(employee.id),
      fullName: employee.full_name,
      email: employee.email || null,
      platform: "LARK",
      platformUserId: larkOpenId
    };
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      throw createHttpError("Lark account conflict", 409);
    }

    throw error;
  } finally {
    client.release();
  }
}

module.exports = { verifyLarkEmployee };
