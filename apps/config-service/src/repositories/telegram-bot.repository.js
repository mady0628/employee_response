const pool = require("../config/database");
const { encrypt, decrypt, fingerprint } = require("../../../../shared/telegram-credentials");

async function findAll() {
  const result = await pool.query(`
    SELECT tb.channel_connection_id AS id,
           cc.name, cc.display_name, cc.connection_status,
           cc.is_enabled, cc.connected_account_id,
           tb.bot_id, tb.bot_username, tb.status, tb.last_error,
           tb.created_at, tb.updated_at,
           COUNT(mg.id) FILTER (WHERE mg.status = 'ACTIVE')::integer AS group_count
    FROM telegram_bots tb
    JOIN channel_connections cc ON cc.id = tb.channel_connection_id
    LEFT JOIN monitored_groups mg ON mg.channel_connection_id = cc.id
    GROUP BY tb.channel_connection_id, cc.id, tb.id
    ORDER BY tb.created_at DESC, tb.id DESC
  `);
  return result.rows;
}

async function create({ displayName, botId, botUsername, botToken, webhookSecret }) {
  const client = await pool.connect();
  const botTokenFingerprint = fingerprint(botToken);
  try {
    await client.query("BEGIN");
    const connection = await client.query(
      `INSERT INTO channel_connections (
         platform, external_account_id, name, display_name, account_username,
         status, connection_status, is_enabled, desired_state
       ) VALUES ('TELEGRAM', $1, $2, $2, $3, 'ACTIVE', 'PENDING', TRUE, 'RUNNING')
       RETURNING id`,
      [`telegram_${botId}`, displayName, botUsername || null]
    );
    const connectionId = connection.rows[0].id;
    await client.query(
      `INSERT INTO telegram_bots (
         channel_connection_id, bot_id, bot_username, bot_token_fingerprint,
         bot_token_ciphertext, webhook_secret_ciphertext
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [connectionId, String(botId), botUsername || null, botTokenFingerprint,
        encrypt(botToken), encrypt(webhookSecret)]
    );
    await client.query("COMMIT");
    return (await findOne(connectionId));
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") {
      const conflict = new Error("Telegram bot đã được thêm vào hệ thống");
      conflict.status = 409;
      throw conflict;
    }
    throw error;
  } finally {
    client.release();
  }
}

async function findOne(connectionId) {
  const result = await pool.query(
    `SELECT tb.channel_connection_id AS id,
            cc.name, cc.display_name, cc.connection_status,
            cc.is_enabled, cc.connected_account_id,
            tb.bot_id, tb.bot_username, tb.status, tb.last_error,
            tb.created_at, tb.updated_at
     FROM telegram_bots tb
     JOIN channel_connections cc ON cc.id = tb.channel_connection_id
     WHERE tb.channel_connection_id = $1`,
    [connectionId]
  );
  return result.rows[0] || null;
}

async function getRuntimeCredentials(connectionId) {
  const result = await pool.query(
    `SELECT tb.channel_connection_id AS id, tb.bot_id, tb.bot_username,
            tb.bot_token_ciphertext, tb.webhook_secret_ciphertext
     FROM telegram_bots tb
     WHERE tb.channel_connection_id = $1`,
    [connectionId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    botId: row.bot_id,
    botUsername: row.bot_username,
    botToken: decrypt(row.bot_token_ciphertext),
    webhookSecret: decrypt(row.webhook_secret_ciphertext)
  };
}

async function updateStatus(connectionId, status, errorMessage = null) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE telegram_bots
       SET status = $2, last_error = $3, updated_at = NOW()
       WHERE channel_connection_id = $1
       RETURNING channel_connection_id`,
      [connectionId, status, errorMessage]
    );
    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return null;
    }
    await client.query(
      `UPDATE channel_connections
       SET connection_status = $2, last_error = $3, updated_at = NOW()
       WHERE id = $1`,
      [connectionId, status, errorMessage]
    );
    await client.query("COMMIT");
    return findOne(connectionId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { findAll, findOne, create, getRuntimeCredentials, updateStatus };
