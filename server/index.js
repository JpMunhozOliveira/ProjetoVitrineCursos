const app = require("./app");
const pool = require("./config/database");
const { isUsableApiKey } = require("./middleware/admin-auth");
const { configuredBaseUrl } = require("./lib/base-url");

const port = Number(process.env.PORT || 3000);

if (process.env.ADMIN_API_KEY && !isUsableApiKey(process.env.ADMIN_API_KEY)) {
  console.warn("ADMIN_API_KEY ignorada: use uma chave aleatória com 32+ caracteres (node scripts/gerar-env.js).");
}

// PUBLIC_URL errada derrubaria cada página de vendas: melhor recusar já na inicialização.
try {
  if (!configuredBaseUrl() && process.env.NODE_ENV === "production") {
    console.warn("PUBLIC_URL vazia: os links absolutos das páginas usam o cabeçalho Host da requisição. Defina-a no servidor público.");
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
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
