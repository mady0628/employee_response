const pool = require("../config/database");
const sanitizeErrorMessage = require("../../../../shared/sanitize-error-message");

const ALLOWED_STATUSES = new Set([
  "CREATED",
  "CONNECTING",
  "QR_PENDING",
  "AUTHENTICATED",
  "CONNECTED",
  "DISCONNECTED",
  "STOPPED",
  "LOGGED_OUT",
  "ERROR"
]);

async function claimRuntime({
  connectionId,
  generation,
  runtimeInstanceId
}) {
  const result = await pool.query(
    `UPDATE channel_connections
     SET
       runtime_instance_id = $3::uuid,
       connection_status = 'CONNECTING',
       runtime_heartbeat_at = NOW(),
       updated_at = NOW()
     WHERE id = $1
       AND session_generation = $2
       AND is_enabled = TRUE
       AND desired_state = 'RUNNING'
       AND platform = 'WHATSAPP'
       AND (
         runtime_instance_id IS NULL
         OR runtime_heartbeat_at IS NULL
         OR runtime_heartbeat_at < NOW() - INTERVAL '90 seconds'
       )
     RETURNING id, runtime_instance_id, session_generation`,
    [connectionId, generation, runtimeInstanceId]
  );

  return result.rows[0] || null;
}

async function updateRuntime({
  connectionId,
  generation,
  status,
  accountId = null,
  errorMessage = null,
  runtimeInstanceId = null
}) {
  if (
    !ALLOWED_STATUSES.has(status) ||
    !Number.isSafeInteger(Number(generation)) ||
    Number(generation) < 1
  ) {
    throw new Error("Invalid connection runtime");
  }

  let query = `
    UPDATE channel_connections
    SET
      connection_status = $3::varchar,

      connected_account_id =
        CASE
          WHEN $3::varchar = 'CONNECTED' THEN $4::varchar
          WHEN $3::varchar = 'LOGGED_OUT' THEN NULL
          ELSE connected_account_id
        END,

      last_connected_at =
        CASE
          WHEN $3::varchar = 'CONNECTED' THEN NOW()
          ELSE last_connected_at
        END,

      last_disconnected_at =
        CASE
          WHEN $3::varchar IN (
            'DISCONNECTED',
            'STOPPED',
            'LOGGED_OUT',
            'ERROR'
          ) THEN NOW()
          ELSE last_disconnected_at
        END,

      last_error = $5::text,
      runtime_instance_id = CASE
        WHEN $3::varchar IN ('STOPPED', 'LOGGED_OUT', 'ERROR') THEN NULL
        ELSE runtime_instance_id
      END,
      runtime_heartbeat_at = NOW(),
      session_generation = CASE
        WHEN $3::varchar = 'LOGGED_OUT' THEN session_generation + 1
        ELSE session_generation
      END,
      account_changed_at = CASE
        WHEN $3::varchar = 'LOGGED_OUT' THEN NOW()
        ELSE account_changed_at
      END,
      updated_at = NOW()

    WHERE id = $1
      AND session_generation = $2
      AND platform = 'WHATSAPP'
  `;

  const params = [
    connectionId,
    generation,
    status,
    accountId,
    sanitizeErrorMessage(errorMessage, 500)
  ];

  if (runtimeInstanceId) {
    params.push(runtimeInstanceId);
    query += ` AND runtime_instance_id = $${params.length}::uuid`;
  }

  query += `
    RETURNING
      id,
      connection_status,
      connected_account_id,
      session_generation,
      runtime_instance_id
  `;

  const result = await pool.query(query, params);
  return result.rows[0] || null;
}

async function heartbeatRuntime({ connectionId, generation, runtimeInstanceId }) {
  const result = await pool.query(
    `UPDATE channel_connections
     SET runtime_heartbeat_at = NOW(), updated_at = NOW()
     WHERE id = $1
       AND session_generation = $2
       AND runtime_instance_id = $3::uuid
       AND desired_state = 'RUNNING'
       AND platform = 'WHATSAPP'
     RETURNING id, runtime_heartbeat_at`,
    [connectionId, generation, runtimeInstanceId]
  );
  return result.rows[0] || null;
}

module.exports = {
  claimRuntime,
  updateRuntime,
  heartbeatRuntime,
  ALLOWED_STATUSES
};
