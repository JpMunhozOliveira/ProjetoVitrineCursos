const express = require("express");
const path = require("path");
const healthRoutes = require("./routes/health.routes");
const productRoutes = require("./routes/product.routes");
const adminProductRoutes = require("./routes/admin-product.routes");
const adminAuthRoutes = require("./routes/admin-auth.routes");
const adminMediaRoutes = require("./routes/admin-media.routes");
const adminSharedBlockRoutes = require("./routes/admin-shared-block.routes");
const storage = require("./lib/storage");
const { showPublicPage, showPreview } = require("./controllers/page-view.controller");
const requireAdmin = require("./middleware/admin-auth");
const { findSession } = requireAdmin;
const { getBlockSchema } = require("./controllers/sales-page.controller");
const { themeStylesheet, checkColors } = require("./sales/theme");

const app = express();

app.disable("x-powered-by");

// Atrás de proxy HTTPS (Nginx, Caddy, Cloudflare...), o IP do visitante e o "https" chegam nos
// cabeçalhos X-Forwarded-*. TRUST_PROXY = quantos proxies há na frente (normalmente 1). Sem isso,
// todos parecem ter o IP do proxy: o limite de tentativas de login vira um só para o mundo inteiro.
if (process.env.TRUST_PROXY) {
  const hops = Number(process.env.TRUST_PROXY);
  app.set("trust proxy", Number.isInteger(hops) ? hops : process.env.TRUST_PROXY); // ou lista de IPs/sub-redes
}

app.use(express.json({ limit: "300kb" })); // páginas de vendas com muitos blocos passam de 100 KB

// Cabeçalhos básicos de todas as respostas; o painel e as páginas de vendas reforçam abaixo.
// A CSP vale também para as páginas estáticas do site (catálogo, produto...): só recursos do
// próprio site, como rede de segurança caso algum dado escape para o HTML.
// HSTS só com HTTPS confirmado (COOKIE_SECURE=true): o navegador passa a recusar http:// no domínio.
const HSTS = process.env.COOKIE_SECURE === "true" ? { "Strict-Transport-Security": "max-age=31536000" } : {};
app.use((_req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy":
      "default-src 'self'; img-src 'self' data:; base-uri 'self'; form-action 'self'; frame-ancestors 'self'",
    ...HSTS,
  });
  next();
});

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
app.use("/api/admin/shared-blocks", adminSharedBlockRoutes);
app.get("/api/admin/sales-blocks", requireAdmin, getBlockSchema);

// Cores da página de vendas (ver sales/theme.js). As cores vêm na URL e são validadas; como a
// resposta depende só delas, o navegador pode guardar em cache por 1 ano.
app.get("/page-theme.css", (req, res) => {
  const hero = `#${String(req.query.fundo || "").toLowerCase()}`;
  const accent = `#${String(req.query.botao || "").toLowerCase()}`;
  const HEX = /^#[0-9a-f]{6}$/;
  if (!HEX.test(hero) || !HEX.test(accent)) return res.status(400).type("css").send("/* cores inválidas */");
  try { checkColors(hero, accent); } catch { return res.status(400).type("css").send("/* combinação recusada */"); }
  res.set({ "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" });
  return res.type("css").send(themeStylesheet(hero, accent));
});

// Endereços antigos -> novos (301 = mudança permanente: o Google atualiza o endereço e links
// já divulgados continuam funcionando).
app.get("/curso-reforma-tributaria.html", (_req, res) => res.redirect(301, "/p/manual-reforma-tributaria"));
app.get("/curso.html", (req, res) => {
  const id = typeof req.query.id === "string" ? req.query.id : "";
  res.redirect(301, id ? `/produto.html?id=${encodeURIComponent(id)}` : "/catalogo.html");
});

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

// Páginas do painel: confere a sessão antes de entregar o HTML. Sem isso, o navegador mostrava o
// painel vazio por um instante até o JavaScript descobrir que não havia login ("pisca").
// Só páginas (/admin/ e *.html); JS, CSS e o editor seguem livres para o express.static.
// Sem diferenciar maiúsculas: em disco do Windows, /admin/INDEX.HTML abriria o mesmo arquivo.
const ADMIN_PAGE = /^\/(?:[a-z0-9-]+\.html)?$/i;
app.use("/admin", async (req, res, next) => {
  if ((req.method !== "GET" && req.method !== "HEAD") || !ADMIN_PAGE.test(req.path)) return next();
  const loggedIn = Boolean(await findSession(req));
  if (req.path.toLowerCase() === "/login.html") return loggedIn ? res.redirect(302, "/admin/") : next();
  return loggedIn ? next() : res.redirect(302, "/admin/login.html");
});

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
