const fs = require("node:fs");
const path = require("node:path");

const schemaPath = path.join(__dirname, "schema.sql");
const schemaSql = fs.readFileSync(schemaPath, "utf8");
const schemaLockId = 2026112001;

async function initializeDatabase(pool, serviceName) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [schemaLockId]);
    await client.query(schemaSql);
    const firstResponseMinutes = Number(process.env.SLA_TIMEOUT_MINUTES || 10);
    const reminderIntervalMinutes = Number(process.env.REMINDER_INTERVAL_MINUTES || firstResponseMinutes);
    const safeFirstResponse = Number.isInteger(firstResponseMinutes) && firstResponseMinutes >= 1 && firstResponseMinutes <= 240
      ? firstResponseMinutes
      : 10;
    const safeReminderInterval = Number.isInteger(reminderIntervalMinutes) && reminderIntervalMinutes >= 1 && reminderIntervalMinutes <= 240
      ? reminderIntervalMinutes
      : safeFirstResponse;
    await client.query(
      `INSERT INTO sla_policy_settings (id, first_response_minutes, reminder_interval_minutes)
       VALUES (1, $1, $2)
       ON CONFLICT (id) DO NOTHING`,
      [safeFirstResponse, safeReminderInterval]
    );
    await client.query("COMMIT");
    console.log(`${serviceName} database schema initialized`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(`${serviceName} database schema initialization failed:`, error.message);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { initializeDatabase };
