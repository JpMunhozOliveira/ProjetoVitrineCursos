const app = require("./app");
const pool = require("./config/database");
const { isUsableApiKey } = require("./middleware/admin-auth");

const port = Number(process.env.PORT || 3000);

if (process.env.ADMIN_API_KEY && !isUsableApiKey(process.env.ADMIN_API_KEY)) {
  console.warn("ADMIN_API_KEY ignorada: use uma chave aleatória com 32+ caracteres (node scripts/gerar-env.js).");
}

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
