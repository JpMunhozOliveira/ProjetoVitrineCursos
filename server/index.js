const app = require("./app");
const pool = require("./config/database");
const { isUsableApiKey } = require("./middleware/admin-auth");
const { configuredBaseUrl } = require("./lib/base-url");
const { backfillVariants } = require("./lib/image-variants");
const { startAutoSync } = require("./lib/kiwify-sync");
const box = require("./lib/crypto-box");

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
  // Imagens enviadas antes das versões menores existirem: gera em segundo plano.
  backfillVariants().catch((error) => console.error("Versões menores das imagens:", error.message));
  // Preço e link dos produtos vinculados à Kiwify: 1 min após subir e a cada 6 h.
  if (box.isConfigured()) startAutoSync();
  else console.warn("KIWIFY_ENCRYPTION_KEY ausente: integração com a Kiwify desligada (node scripts/gerar-env.js cria a chave).");
});

// O Caddy reaproveita conexões ociosas com o app por até 2 min; o Node fecha as dele após 5 s
// (padrão). Se o Node fecha justo quando o Caddy reaproveita, o visitante recebe um erro 502.
// Com o Node esperando mais que o proxy, quem fecha é sempre o Caddy.
server.keepAliveTimeout = 125_000;
server.headersTimeout = 126_000; // precisa ser maior que keepAliveTimeout

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
