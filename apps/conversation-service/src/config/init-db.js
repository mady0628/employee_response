const pool = require("./database");
const { initializeDatabase } = require("../../../../database/init");

async function initDatabase() {
  await initializeDatabase(pool, "Conversation Service");
}

module.exports = { initDatabase };
