const pool = require("../config/database");

async function discoverGroup({
  channelConnectionId,
  externalGroupId,
  groupName,
  autoActivate = true
}) {
  const initialStatus = autoActivate ? "ACTIVE" : "PAUSED";

  const result = await pool.query(
    `INSERT INTO monitored_groups (
       channel_connection_id,
       external_group_id,
       group_name,
       status,
       monitoring_started_at,
       discovered_at,
       last_seen_at
     )
     VALUES ($1, $2, $3, $4, NOW(), NOW(), NOW())
     ON CONFLICT (channel_connection_id, external_group_id)
     DO UPDATE SET
       group_name = COALESCE(EXCLUDED.group_name, monitored_groups.group_name),
       last_seen_at = NOW(),
       updated_at = NOW()
     RETURNING *`,
    [channelConnectionId, externalGroupId, groupName, initialStatus]
  );

  return result.rows[0];
}

async function getGroup(channelConnectionId, externalGroupId) {
  const result = await pool.query(
    `SELECT *
     FROM monitored_groups
     WHERE channel_connection_id = $1
       AND external_group_id = $2`,
    [channelConnectionId, externalGroupId]
  );

  return result.rows[0] || null;
}

async function listMonitoredGroups(channelConnectionId) {
  const params = [];
  let query = `SELECT mg.*, cc.platform, COALESCE(cc.display_name, cc.name) AS connection_name,
                      cc.connection_status
               FROM monitored_groups mg
               JOIN channel_connections cc ON cc.id = mg.channel_connection_id`;

  if (channelConnectionId) {
    params.push(channelConnectionId);
    query += ` WHERE mg.channel_connection_id = $1`;
  }

  query += ` ORDER BY mg.discovered_at DESC`;

  const result = await pool.query(query, params);
  return result.rows;
}

module.exports = {
  discoverGroup,
  getGroup,
  listMonitoredGroups
};
