const pool = require("../config/database");

async function findAllConnections() {
  const result = await pool.query(`
    SELECT
      cc.id,
      cc.platform,
      cc.name,
      cc.display_name,
      cc.desired_state,
      cc.connection_status,
      cc.is_enabled,
      cc.connected_account_id,
      cc.connected_phone,
      cc.session_generation,
      cc.connected_at,
      cc.last_connected_at,
      cc.last_disconnected_at,
      cc.last_error,
      cc.runtime_instance_id,
      cc.runtime_heartbeat_at,
      COUNT(mg.id) FILTER (
        WHERE mg.status = 'ACTIVE'
      )::integer AS group_count
    FROM channel_connections cc
    LEFT JOIN monitored_groups mg
      ON mg.channel_connection_id = cc.id
    GROUP BY cc.id
    ORDER BY cc.id DESC
  `);
  return result.rows;
}

async function findConnectionById(id) {
  const result = await pool.query(
    `SELECT
       id,
       platform,
       name,
       display_name,
       desired_state,
       connection_status,
       is_enabled,
       connected_account_id,
       connected_phone,
       session_generation,
       connected_at,
       last_connected_at,
       last_disconnected_at,
       last_error,
       runtime_instance_id,
       runtime_heartbeat_at
     FROM channel_connections
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function createWhatsAppConnection(displayName) {
  const name =
    typeof displayName === "string" && displayName.trim()
      ? displayName.trim()
      : `WhatsApp Sales ${Date.now().toString().slice(-4)}`;
  const externalId = `wa_${Date.now()}`;

  const result = await pool.query(
    `INSERT INTO channel_connections (
       platform,
       external_account_id,
       name,
       display_name,
       status,
       desired_state,
       connection_status,
       is_enabled,
       session_generation
     )
     VALUES (
       'WHATSAPP',
       $1,
       $2,
       $2,
       'ACTIVE',
       'STOPPED',
       'CREATED',
       FALSE,
       1
     )
     RETURNING
       id,
       platform,
       name,
       display_name,
       desired_state,
       connection_status,
       is_enabled,
       session_generation,
       created_at`,
    [externalId, name]
  );

  return result.rows[0];
}

async function setDesiredState(connectionId, desiredState) {
  if (!["RUNNING", "STOPPED"].includes(desiredState)) {
    throw new Error("Invalid desired state");
  }

  const result = await pool.query(
    `UPDATE channel_connections
     SET
       desired_state = $2::varchar,
       is_enabled = ($2::varchar = 'RUNNING'),
       updated_at = NOW()
     WHERE id = $1
       AND platform = 'WHATSAPP'
     RETURNING
       id,
       desired_state,
       is_enabled,
       session_generation`,
    [connectionId, desiredState]
  );

  return result.rows[0] || null;
}

async function findRunnableWhatsAppConnections() {
  const result = await pool.query(
    `SELECT
       id,
       display_name,
       session_generation
     FROM channel_connections
     WHERE platform = 'WHATSAPP'
       AND is_enabled = TRUE
       AND desired_state = 'RUNNING'
     ORDER BY id`
  );
  return result.rows;
}

async function updateConnectionRuntime({ connectionId, status, details = {} }) {
  let query = `
    UPDATE channel_connections
    SET connection_status = $2,
        updated_at = NOW()
  `;
  const params = [connectionId, status];

  if (status === "CONNECTED") {
    query += `, last_connected_at = NOW(),
               connected_at = NOW(),
               last_error = NULL`;
    if (details.accountId) {
      params.push(details.accountId);
      query += `, connected_account_id = $${params.length}`;
    }
  } else if (status === "DISCONNECTED" || status === "STOPPED") {
    query += `, last_disconnected_at = NOW()`;
    if (details.reason) {
      params.push(details.reason);
      query += `, last_error = $${params.length}`;
    }
  } else if (status === "ERROR") {
    if (details.error) {
      params.push(details.error);
      query += `, last_error = $${params.length}`;
    }
  } else if (status === "LOGGED_OUT") {
    query += `, last_disconnected_at = NOW(),
               connected_account_id = NULL,
               connected_phone = NULL,
               session_generation = session_generation + 1`;
  }

  query += ` WHERE id = $1 RETURNING *`;
  const result = await pool.query(query, params);
  return result.rows[0] || null;
}

async function updateConnectionEnabled(id, isEnabled) {
  const result = await pool.query(
    `UPDATE channel_connections
     SET is_enabled = $2,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, Boolean(isEnabled)]
  );
  return result.rows[0] || null;
}

module.exports = {
  findAllConnections,
  findConnectionById,
  createWhatsAppConnection,
  setDesiredState,
  findRunnableWhatsAppConnections,
  updateConnectionRuntime,
  updateConnectionEnabled
};
