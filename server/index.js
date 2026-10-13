const express = require("express");
const { Pool } = require("pg");

const app = express();
const port = Number(process.env.PORT || 3000);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({
      status: "ok",
      database: "connected",
    });
  } catch (error) {
    console.error("Health check failed:", error.message);
    res.status(503).json({
      status: "error",
      database: "unavailable",
    });
  }
});

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`Vitrine de Cursos API listening on port ${port}`);
});

async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
