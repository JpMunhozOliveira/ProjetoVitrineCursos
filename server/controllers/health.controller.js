const pool = require("../config/database");

async function getHealth(_req, res) {
  try {
    await pool.query("SELECT 1");

    return res.status(200).json({
      status: "ok",
      database: "connected",
    });
  } catch (error) {
    console.error("Health check failed:", error.message);

    return res.status(503).json({
      status: "error",
      database: "unavailable",
    });
  }
}

module.exports = { getHealth };
