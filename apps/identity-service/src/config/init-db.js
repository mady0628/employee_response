const pool = require("./database");
const { initializeDatabase } = require("../../../../database/init");

async function initDatabase() {
  await initializeDatabase(pool, "Identity Service");
}

module.exports = { initDatabase };
