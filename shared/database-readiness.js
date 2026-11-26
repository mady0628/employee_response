function attachDatabaseReadiness(app, pool) {
  app.get("/ready", async (req, res) => {
    try {
      await pool.query("SELECT 1");
      return res.status(200).json({ status: "READY" });
    } catch {
      return res.status(503).json({ status: "NOT_READY" });
    }
  });
}

module.exports = attachDatabaseReadiness;
