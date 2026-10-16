// Monta o HTML da página de vendas a partir dos blocos. A marcação segue a página original do
// Manual (mesmas classes de public/css/venda.css), então o visual é o mesmo.
const { html } = require("../lib/html");
const { BLOCKS, ICONS, validateSections } = require("./blocks");
const { normalizeTheme, themeHref, DEFAULT_THEME } = require("./theme");

const brl = (cents) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Textos com várias linhas: cada parágrafo (separado por linha em branco) vira um <p>.
const paragraphs = (text, cls) => (text || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  .map((p) => (cls ? html`<p class="${cls}">${p}</p>` : html`<p>${p}</p>`));

const svg = (name, cls = "ico") => html`<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const mark = (positive) => html`<svg aria-hidden="true"><use href="#i-${positive ? "check" : "x"}"/></svg>`;

// Sprite com os ícones dos blocos (desenhos definidos em blocks.js, compartilhados com o editor).
const SPRITE = html`<svg class="svg-sprite" aria-hidden="true">${Object.entries(ICONS).map(([name, icon]) =>
  html`<symbol id="i-${name}" viewBox="0 0 24 24"><path d="${icon.d}" fill="none" stroke="currentColor" stroke-width="${icon.width || 1.8}" stroke-linecap="round" stroke-linejoin="round"/></symbol>`)}</svg>`;

// Contexto de uma renderização: produto, imagens e contadores (ids de títulos, fundo alternado).
function createContext(data) {
  let sectionCount = 0, headingCount = 0, heroCount = 0;
  return {
    product: data,
    // <img> de uma imagem da biblioteca; "priority" para a primeira dobra (não espera rolar).
    img(id, cls, { priority = false } = {}) {
      const m = id && data.media.get(id);
      if (!m) return null;
      return html`<img class="${cls}" src="${m.url}" alt="${m.alt_text || ""}" width="${m.width}" height="${m.height}" ${priority ? html`fetchpriority="high"` : html`loading="lazy"`} decoding="async">`;
    },
    // Botão de compra: o link vem SEMPRE do cadastro do produto (fonte única).
    cta(label) {
      if (!data.checkout_url) return html`<span class="btn-cta is-disabled" aria-disabled="true">Em breve</span>`;
      return html`<a class="btn-cta" href="${data.checkout_url}" target="_blank" rel="noopener noreferrer">${label}<span class="sr-only"> (abre em nova aba)</span></a>`;
    },
    price(label) {
      if (data.price_cents === null || data.price_cents === undefined) return null;
      return html`<p class="price-big">${label && html`<span class="muted-on-dark">${label}</span>`} ${brl(data.price_cents)}</p>`;
    },
    headingId: () => `t-${++headingCount}`,
    // Seções comuns alternam o fundo (branco / cinza) na ordem em que aparecem.
    sectionClass: () => (sectionCount++ % 2 ? "v-section alt" : "v-section"),
    firstHero: () => heroCount++ === 0,
  };
}

const RENDERERS = {
  hero(b, ctx) {
    const media = ctx.img(b.image, "v-media", { priority: true });
    const Title = ctx.firstHero() ? "h1" : "h2"; // só um <h1> por página
    const title = b.title || ctx.product.title;
    return html`<section class="v-hero"${ctx.mark()}>
  <div class="container v-hero-grid${media ? "" : " no-media"}">
    <div>
      ${ctx.img(b.logo, "v-logo", { priority: true })}
      ${Title === "h1" ? html`<h1>${title}</h1>` : html`<h2>${title}</h2>`}
      ${b.lead && html`<p class="lead">${b.lead}</p>`}
      ${b.badges.length > 0 && html`<ul class="badges" aria-label="Resumo do material">${b.badges.map((x) => html`<li>${x.strong && html`<strong>${x.strong}</strong>`} ${x.text}</li>`)}</ul>`}
      <div class="offer">${ctx.price(b.price_label)}${ctx.cta(b.cta_label || "Comprar agora")}</div>
    </div>
    ${media}
  </div>
</section>`;
  },

  benefits(b, ctx) {
    if (!b.items.length) return null;
    const id = ctx.headingId();
    return html`<section class="${ctx.sectionClass()}" aria-labelledby="${id}"${ctx.mark()}><div class="container">
  <h2 id="${id}" class="sr-only">${b.title || "Benefícios"}</h2>
  <div class="two">${b.items.map((x) => html`<article class="v-card">${svg(x.icon)}<h3>${x.title}</h3>${paragraphs(x.text)}${x.callout && html`<p class="callout">${x.callout}</p>`}</article>`)}</div>
</div></section>`;
  },

  topics(b, ctx) {
    if (!b.items.length) return null;
    const id = ctx.headingId();
    return html`<section class="${ctx.sectionClass()}" aria-labelledby="${id}"${ctx.mark()}><div class="container">
  <h2 id="${id}">${b.title}</h2>
  <ul class="grid8">${b.items.map((x) => html`<li>${svg(x.icon)}<strong>${x.title}</strong><span>${x.text}</span></li>`)}</ul>
</div></section>`;
  },

  gallery(b, ctx) {
    const slides = b.images.map((x) => ctx.img(x.image, "slide-img")).filter(Boolean);
    if (!slides.length) return null;
    const id = ctx.headingId();
    return html`<section class="${ctx.sectionClass()}" aria-labelledby="${id}"${ctx.mark()}><div class="container">
  <h2 id="${id}">${b.title}</h2>
  <div class="carousel" role="region" aria-roledescription="carrossel" aria-labelledby="${id}">
    <button class="car-btn prev" type="button" aria-label="Slide anterior" hidden>‹</button>
    <ul class="track">${slides.map((img, i) => html`<li class="slide" aria-label="Slide ${i + 1} de ${slides.length}">${img}</li>`)}</ul>
    <button class="car-btn next" type="button" aria-label="Próximo slide" hidden>›</button>
    <div class="dots" hidden></div>
  </div>
</div></section>`;
  },

  checklist(b, ctx) {
    if (!b.items.length) return null;
    const id = ctx.headingId();
    return html`<section class="${ctx.sectionClass()}" aria-labelledby="${id}"${ctx.mark()}><div class="container narrow">
  <div class="v-card center">${svg(b.icon, "ico big")}<h2 id="${id}">${b.title}</h2>
    <ul class="mini">${b.items.map((x) => html`<li class="${x.positive ? "yes" : "no"}">${mark(x.positive)}${x.text}</li>`)}</ul>
  </div>
</div></section>`;
  },

  comparison(b, ctx) {
    const id = ctx.headingId();
    const side = (title, items, positive) => html`<article class="v-card${positive ? " dark" : ""}"><h3>${title}</h3>
      <ul class="mini">${items.map((x) => html`<li class="${positive ? "yes" : "no"}">${mark(positive)}${x.text}</li>`)}</ul></article>`;
    return html`<section class="${ctx.sectionClass()}" aria-labelledby="${id}"${ctx.mark()}><div class="container">
  <h2 id="${id}">${b.title}</h2>
  <div class="versus">${side(b.left_title, b.left_items, false)}<div class="vs" aria-hidden="true">VS</div>${side(b.right_title, b.right_items, true)}</div>
</div></section>`;
  },

  author(b, ctx) {
    if (!b.name) return null;
    const id = ctx.headingId();
    const photo = ctx.img(b.photo, "author-photo");
    return html`<section class="${ctx.sectionClass()}" aria-labelledby="${id}"${ctx.mark()}><div class="container author${photo ? "" : " no-media"}">
  ${photo}
  <div><h2 id="${id}">${b.name}</h2>${b.role && html`<p class="muted"><strong>${b.role}</strong></p>`}${paragraphs(b.bio)}</div>
</div></section>`;
  },

  audience(b, ctx) {
    if (!b.items.length) return null;
    const id = ctx.headingId();
    return html`<section class="${ctx.sectionClass()}" aria-labelledby="${id}"${ctx.mark()}><div class="container">
  <h2 id="${id}">${b.title}</h2>
  <ul class="who">${b.items.map((x) => html`<li>${svg(x.icon)}${x.text}</li>`)}</ul>
</div></section>`;
  },

  highlight(b, ctx) {
    const id = ctx.headingId();
    return html`<section class="${ctx.sectionClass()}" aria-labelledby="${id}"${ctx.mark()}><div class="container">
  <div class="banner">
    <div><h2 id="${id}">${b.title}</h2>${paragraphs(b.text)}</div>
    ${b.items.length > 0 && html`<ul class="mini">${b.items.map((x) => html`<li class="yes">${mark(true)}${x.text}</li>`)}</ul>`}
  </div>
</div></section>`;
  },

  faq(b, ctx) {
    if (!b.items.length) return null;
    const id = ctx.headingId();
    return html`<section class="${ctx.sectionClass()}" aria-labelledby="${id}"${ctx.mark()}><div class="container narrow">
  <h2 id="${id}">${b.title}</h2>
  ${b.items.map((x) => html`<details class="faq"><summary>${x.question}</summary>${paragraphs(x.answer)}</details>`)}
</div></section>`;
  },

  guarantee(b, ctx) {
    const id = ctx.headingId();
    return html`<section class="${ctx.sectionClass()}" aria-labelledby="${id}"${ctx.mark()}><div class="container narrow">
  <div class="v-card center"><h2 id="${id}">${b.title}</h2>
    ${b.items.length > 0 && html`<ul class="seals">${b.items.map((x) => html`<li>${svg(x.icon)}${x.text}</li>`)}</ul>`}
  </div>
</div></section>`;
  },

  offer(b, ctx) {
    const id = ctx.headingId();
    const media = ctx.img(b.image, "v-media small");
    return html`<section class="v-final" aria-labelledby="${id}"${ctx.mark()}>
  <div class="container v-hero-grid${media ? "" : " no-media"}">
    ${media}
    <div><h2 id="${id}">${b.title || ctx.product.title}</h2><div class="offer">${ctx.price(b.price_label)}${ctx.cta(b.cta_label || "Garantir agora")}</div></div>
  </div>
</section>`;
  },
};

// Blocos inválidos (ex.: dados antigos) são ignorados um a um, em vez de derrubar a página inteira.
// Cada bloco guarda a posição ORIGINAL, para o editor saber a que bloco cada seção corresponde.
function cleanBlocks(sections) {
  return (Array.isArray(sections) ? sections : [])
    .map((block, index) => ({ index, block: block && BLOCKS[block.type] ? validateSections([block]).sections?.[0] : null }))
    .filter((x) => x.block);
}

// Cores da página: só inclui a folha de estilo quando não é a paleta padrão (que já está no venda.css).
// Tema inválido (dado antigo/estragado) cai na paleta padrão em vez de derrubar a página.
function themeLink(stored) {
  let theme;
  try { theme = normalizeTheme(stored && Object.keys(stored).length ? stored : undefined); } catch { return null; }
  if (theme.preset === DEFAULT_THEME) return null;
  return html`<link rel="stylesheet" href="${themeHref(theme)}">`;
}

// data: resultado de loadForRender. options:
//   preview: false (público) | true (pré-visualização salva, com faixa) | "live" (dentro do editor, sem faixa)
function renderSalesPage(data, { baseUrl, preview = false }) {
  const ctx = createContext(data);
  const body = cleanBlocks(data.sections).map(({ block, index }) => {
    // Na pré-visualização, cada seção leva data-block="N" (clicar nela abre o bloco N no editor).
    ctx.mark = () => (preview ? html` data-block="${index}"` : null);
    return RENDERERS[block.type](block, ctx);
  }).filter(Boolean);

  const title = data.seo_title || data.title;
  const description = data.seo_description || data.short_description || "";
  const url = `${baseUrl}/p/${data.slug}`;
  const cover = data.media.get(data.image_id);

  return html`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  ${description && html`<meta name="description" content="${description}">`}
  ${preview ? html`<meta name="robots" content="noindex, nofollow">` : html`<link rel="canonical" href="${url}">`}
  <link rel="icon" type="image/svg+xml" href="/assets/favicon/favicon.svg">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <!-- Prévia do link em WhatsApp, Instagram, Facebook etc. (lidas sem executar JavaScript) -->
  <meta property="og:type" content="product">
  <meta property="og:title" content="${title}">
  ${description && html`<meta property="og:description" content="${description}">`}
  <meta property="og:url" content="${url}">
  ${cover && html`<meta property="og:image" content="${baseUrl}${cover.url}">
  <meta property="og:image:width" content="${cover.width}">
  <meta property="og:image:height" content="${cover.height}">`}
  <meta name="twitter:card" content="${cover ? "summary_large_image" : "summary"}">
  <link rel="stylesheet" href="/css/theme.css">
  <link rel="stylesheet" href="/css/style.css">
  <link rel="stylesheet" href="/css/venda.css">
  ${themeLink(data.theme)}
  <script src="/js/theme.js"></script>
  <script src="/data/site.js" defer></script>
  <script src="/js/components.js" defer></script>
  <script src="/js/main.js" defer></script>
  <script src="/js/venda.js" defer></script>
</head>
<body data-page="venda">
  ${preview === true && html`<div class="preview-banner" role="status"><strong>Pré-visualização do rascunho salvo.</strong> ${data.published_at && data.status === "published" ? "O público vê a última versão publicada; publique no editor para levar estas alterações ao ar." : "Esta página ainda não está visível para o público."}</div>`}
  ${SPRITE}
  <div id="site-header"></div>
  <main id="conteudo" class="venda">
${body}
  </main>
  <footer class="site-footer v-footer">
    <div class="container foot3">
      <div><p><strong data-site="nome"></strong> © <span data-year></span></p></div>
      <div><p><strong>Links úteis</strong></p><p><a href="/catalogo.html">Todos os produtos</a></p><p><a href="/index.html#contato">Suporte</a></p></div>
      <div><p><strong>Contato</strong></p><p><a href="/index.html#contato">E-mail e redes sociais</a></p></div>
    </div>
  </footer>
</body>
</html>`.toString();
}

module.exports = { renderSalesPage };
