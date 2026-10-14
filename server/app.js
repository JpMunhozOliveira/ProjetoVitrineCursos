const express = require("express");
const path = require("path");
const healthRoutes = require("./routes/health.routes");
const productRoutes = require("./routes/product.routes");
const adminProductRoutes = require("./routes/admin-product.routes");
const adminAuthRoutes = require("./routes/admin-auth.routes");
const adminMediaRoutes = require("./routes/admin-media.routes");
const storage = require("./lib/storage");
const { showPublicPage, showPreview } = require("./controllers/page-view.controller");
const requireAdmin = require("./middleware/admin-auth");
const { getBlockSchema } = require("./controllers/sales-page.controller");

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "300kb" })); // páginas de vendas com muitos blocos passam de 100 KB

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
app.use("/api/admin/media", adminMediaRoutes);
app.get("/api/admin/sales-blocks", requireAdmin, getBlockSchema);

// Páginas de vendas geradas no servidor. A CSP só permite recursos do próprio site: mesmo que
// algum texto malicioso escapasse do template, o navegador não carregaria scripts de fora.
app.get("/p/:slug", (_req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy":
      "default-src 'self'; img-src 'self' data:; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  });
  next();
}, showPublicPage);
app.get("/admin/preview/:id", showPreview); // cabeçalhos do /admin (no-store, CSP, noindex) já se aplicam

// Rota de API inexistente responde em JSON, e não com a página HTML padrão do Express.
app.use("/api", (_req, res) => res.status(404).json({ error: "Rota não encontrada." }));

// Imagens enviadas pelo painel. O nome de cada arquivo é único e nunca muda, então o navegador
// pode guardar em cache por 1 ano ("immutable"). nosniff impede que o navegador "adivinhe"
// outro tipo de conteúdo; a CSP bloqueia scripts caso alguém abra o arquivo diretamente.
app.use("/uploads", express.static(storage.UPLOAD_DIR, {
  index: false,
  dotfiles: "deny",
  fallthrough: false, // arquivo inexistente responde 404 aqui, sem cair nas páginas do site
  immutable: true,
  maxAge: "365d",
  setHeaders: (res) => res.set({
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  }),
}));

// Mantém API e frontend na mesma origem no ambiente local, evitando CORS.
const publicDir = process.env.PUBLIC_DIR || path.join(__dirname, "public");
app.use(express.static(publicDir));

// Tratador de erros: o Express 5 encaminha para cá também as exceções de funções async.
// Detalhes técnicos ficam só no log do servidor; o cliente recebe uma mensagem genérica.
app.use((error, _req, res, _next) => {
  if (error.type === "entity.parse.failed") return res.status(400).json({ error: "JSON inválido." });
  if (error.type === "entity.too.large") {
    return res.status(413).json({ error: "Arquivo ou requisição grande demais (imagens: até 5 MB)." });
  }
  // Outros erros do cliente (ex.: arquivo inexistente em /uploads) mantêm o próprio código.
  if (error.status >= 400 && error.status < 500) {
    return res.status(error.status).json({ error: error.status === 404 ? "Não encontrado." : "Requisição inválida." });
  }

  console.error(error);
  return res.status(500).json({ error: "Erro interno do servidor." });
});

module.exports = app;
