// Marca no menu e na aba do navegador (sem banco, para os testes): usada pelas páginas do site
// com a empresa padrão (lib/default-brand.js) e pelas páginas de vendas (sales/render.js).
const { html } = require("./html");

// Atributos do menu (lidos por components.js): nome e logo. Sem nenhum dos dois, nada.
function headerAttrs(brand) {
  if (!brand || (!brand.name && !brand.logo)) return null;
  const logo = brand.logo;
  return html` data-brand-name="${brand.name || ""}"${logo
    ? html` data-brand-logo="${logo.url}" data-brand-logo-w="${logo.width}" data-brand-logo-h="${logo.height}" data-brand-logo-alt="${logo.alt || ""}"`
    : null}`;
}

// Página do site com a empresa padrão: atributos no <div id="site-header"> e o ícone da aba
// trocado pelo dela (ícone próprio, senão o logo). Sem empresa padrão, o HTML fica igual.
const FAVICON = /<link rel="icon" type="image\/png" href="\/assets\/favicon\/favicon\.png">/;
function injectSiteBrand(source, brand) {
  if (!brand) return source;
  let out = source;
  const attrs = headerAttrs(brand);
  if (attrs) out = out.replace('<div id="site-header">', () => `<div id="site-header"${attrs}>`);
  const tab = brand.icon || brand.logo;
  if (tab) out = out.replace(FAVICON, () => String(html`<link rel="icon" href="${tab.url}">`));
  return out;
}

module.exports = { headerAttrs, injectSiteBrand };
