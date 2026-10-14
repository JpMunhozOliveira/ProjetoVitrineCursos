const express = require("express");
const path = require("path");
const healthRoutes = require("./routes/health.routes");
const productRoutes = require("./routes/product.routes");
const adminProductRoutes = require("./routes/admin-product.routes");
const adminAuthRoutes = require("./routes/admin-auth.routes");

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));

// Cabeçalhos de segurança do painel e da API administrativa.
app.use(["/admin", "/api/admin"], (_req, res, next) => {
  res.set({
    "Cache-Control": "no-store",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex",
    "Content-Security-Policy":
      "default-src 'self'; img-src 'self' data:; frame-ancestors 'none'; form-action 'self'",
  });
  next();
});

app.use("/api/health", healthRoutes);
app.use("/api/products", productRoutes);
app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/admin/products", adminProductRoutes);

// Rota de API inexistente responde em JSON, e não com a página HTML padrão do Express.
app.use("/api", (_req, res) => res.status(404).json({ error: "Rota não encontrada." }));

// Mantém API e frontend na mesma origem no ambiente local, evitando CORS.
const publicDir = process.env.PUBLIC_DIR || path.join(__dirname, "public");
app.use(express.static(publicDir));

// Tratador de erros: o Express 5 encaminha para cá também as exceções de funções async.
// Detalhes técnicos ficam só no log do servidor; o cliente recebe uma mensagem genérica.
app.use((error, _req, res, _next) => {
  if (error.type === "entity.parse.failed") return res.status(400).json({ error: "JSON inválido." });
  if (error.type === "entity.too.large") return res.status(413).json({ error: "Requisição grande demais." });

  console.error(error);
  return res.status(500).json({ error: "Erro interno do servidor." });
});

module.exports = app;
