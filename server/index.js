const app = require("./app");
const pool = require("./config/database");

const port = Number(process.env.PORT || 3000);

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`Vitrine de Cursos API listening on port ${port}`);
});

let isShuttingDown = false;

function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  server.close(async (error) => {
    try {
      await pool.end();
    } catch (poolError) {
      console.error("Failed to close PostgreSQL pool:", poolError.message);
      process.exitCode = 1;
    }

    if (error) {
      console.error("Failed to close HTTP server:", error.message);
      process.exitCode = 1;
    }
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
