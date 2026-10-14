// Páginas de vendas em HTML pronto (renderizadas no servidor).
const { html } = require("../lib/html");
const { loadForRender } = require("../sales/pages");
const { renderSalesPage } = require("../sales/render");
const { findSession } = require("../middleware/admin-auth");

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Endereço público do site, usado nas prévias de link (og:url, og:image precisam ser absolutos).
// Em produção, defina PUBLIC_URL (ex.: https://www.seusite.com.br); sem ela, usa o endereço da requisição.
const baseUrl = (req) => (process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");

function notFound(res, message = "A página que você procurou não existe ou não está mais disponível.") {
  res.status(404).type("html").send(html`<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Página não encontrada</title><meta name="robots" content="noindex">
<link rel="stylesheet" href="/css/theme.css"><link rel="stylesheet" href="/css/style.css"><script src="/js/theme.js"></script></head>
<body><main class="container section"><h1>Página não encontrada</h1><p>${message}</p>
<p><a class="btn" href="/catalogo.html">Ver todos os produtos</a></p></main></body></html>`.toString());
}

async function showPublicPage(req, res) {
  if (!SLUG.test(req.params.slug)) return notFound(res);
  const data = await loadForRender({ slug: req.params.slug, published: true });
  if (!data) return notFound(res);
  res.set("Cache-Control", "no-cache"); // o navegador revalida: mudanças publicadas aparecem na hora
  return res.type("html").send(renderSalesPage(data, { baseUrl: baseUrl(req) }));
}

// Pré-visualização para quem está logado no painel: mostra a página mesmo sem publicar.
async function showPreview(req, res) {
  if (!(await findSession(req))) return res.redirect(302, "/admin/login.html");
  if (!UUID.test(req.params.id)) return notFound(res);
  const data = await loadForRender({ productId: req.params.id, published: false });
  if (!data) return notFound(res, "Este produto ainda não tem página de vendas. Crie a página no painel e salve.");
  return res.type("html").send(renderSalesPage(data, { baseUrl: baseUrl(req), preview: true }));
}

module.exports = { showPublicPage, showPreview };
