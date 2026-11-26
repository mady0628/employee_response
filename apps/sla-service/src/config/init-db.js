const pool = require("./database");
const { initializeDatabase } = require("../../../../database/init");

async function initDatabase() {
  await initializeDatabase(pool, "SLA Service");
}

module.exports = { initDatabase };
