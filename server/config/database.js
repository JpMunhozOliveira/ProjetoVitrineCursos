const { Pool } = require("pg");

// Timeouts: com o banco travado ou sobrecarregado, a requisição falha (erro 500) em vez de
// ficar pendurada para sempre segurando uma das conexões do pool.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5000, // espera máxima por uma conexão livre
  idleTimeoutMillis: 30000,
  statement_timeout: 15000,      // consulta mais lenta que isso é cancelada pelo Postgres
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error.message);
});

module.exports = pool;
