const pool = require("../config/database");

async function createChannel(data) {
  const result = await pool.query(
    `INSERT INTO channel_connections (
       platform,
       external_account_id,
       name,
       account_username,
       credential_reference
     )
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      data.platform,
      data.externalAccountId,
      data.name,
      data.accountUsername,
      data.credentialReference
    ]
  );

  return result.rows[0];
}

async function findAll(platform = null) {
  const result = await pool.query(
    `SELECT * FROM channel_connections
     WHERE ($1::VARCHAR IS NULL OR platform = $1)
     ORDER BY id DESC`,
    [platform]
  );

  return result.rows;
}

async function findById(id) {
  const result = await pool.query(
    `SELECT * FROM channel_connections
     WHERE id = $1`,
    [id]
  );

  return result.rows[0] || null;
}

module.exports = {
  createChannel,
  findAll,
  findById
};
