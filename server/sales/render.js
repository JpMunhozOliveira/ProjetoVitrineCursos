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

// Rótulo de um campo pelo caminho ("items.0.question" -> "Pergunta"), para o texto de exemplo.
function fieldLabel(type, path) {
  let fields = BLOCKS[type]?.fields, field = null;
  for (const part of path.split(".")) {
    if (/^\d+$/.test(part)) continue;
    field = fields?.[part];
    fields = field?.item;
  }
  return field?.label || "";
}

// Fundo padrão dos tipos que não seguem a alternância claro/cinza (como no conceito visual:
// o autor fica numa faixa escura). Abertura, oferta e chamada são sempre escuras.
const BACKGROUND_DEFAULT = { author: "dark" };

// Contexto de uma renderização: produto, imagens e contadores (ids de títulos, fundo alternado).
// live = true: pré-visualização dentro do editor, com os textos marcados para edição direta.
function createContext(data, { live = false } = {}) {
  let sectionCount = 0, headingCount = 0, heroCount = 0;
  const ctx = {
    product: data,
    live,
    type: null, // tipo do bloco sendo desenhado (o laço de renderSalesPage atualiza)

    /* ---- Edição direta no editor (só com live = true) ----
       Na página pública estes devolvem a marcação de sempre (ou nada): o público não vê diferença. */

    // Atributos de um texto editável: data-field="items.0.question" (caminho dentro do bloco).
    // Vazio -> data-empty + data-placeholder (o editor mostra o rótulo só no bloco selecionado).
    // fallback: o texto exibido é um padrão (ex.: título do produto); editar grava o campo do bloco.
    field(path, value, { fallback = false } = {}) {
      if (!live) return null;
      const empty = !value && !fallback;
      return html` data-field="${path}"${empty ? html` data-empty data-placeholder="${fieldLabel(ctx.type, path)}"` : null}${fallback && !value ? html` data-fallback` : null}`;
    },
    // Texto que divide o elemento com outra coisa (ícone, outro texto): ganha um <span> só no editor.
    text(path, value) {
      return live ? html`<span${ctx.field(path, value)}>${value}</span>` : value;
    },
    // Texto longo (parágrafos): no editor, os <p> ficam dentro de um <div> editável.
    paras(path, value, cls) {
      return live ? html`<div${ctx.field(path, value)} data-multiline>${paragraphs(value, cls)}</div>` : paragraphs(value, cls);
    },
    // Campo opcional: na página pública só aparece preenchido; no editor, sempre (vazio = espaço para digitar).
    show: (value) => live || !!value,

    // <img> de uma imagem da biblioteca; "priority" para a primeira dobra (não espera rolar).
    img(id, cls, { priority = false } = {}) {
      const m = id && data.media.get(id);
      if (!m) return null;
      return html`<img class="${cls}" src="${m.url}" alt="${m.alt_text || ""}" width="${m.width}" height="${m.height}" ${priority ? html`fetchpriority="high"` : html`loading="lazy"`} decoding="async">`;
    },
    // Botão de compra: o link vem SEMPRE do cadastro do produto (fonte única).
    // label: texto do bloco (vazio = usa o fallback); path: o campo, para a edição no editor.
    cta(label, fallback, path) {
      if (!data.checkout_url) return html`<span class="btn-cta is-disabled" aria-disabled="true">Em breve</span>`;
      const text = live ? html`<span${ctx.field(path, label, { fallback: true })}>${label || fallback}</span>` : label || fallback;
      return html`<a class="btn-cta" href="${data.checkout_url}" target="_blank" rel="noopener noreferrer">${text}<span class="sr-only"> (abre em nova aba)</span></a>`;
    },
    price(label, path) {
      if (data.price_cents === null || data.price_cents === undefined) return null;
      return html`<p class="price-big">${ctx.show(label) && html`<span class="muted-on-dark"${ctx.field(path, label)}>${label}</span>`} ${brl(data.price_cents)}</p>`;
    },
    // Rótulo curto em caixa alta acima do título (opcional).
    eyebrow: (b) => ctx.show(b.eyebrow) && html`<p class="v-eyebrow"${ctx.field("eyebrow", b.eyebrow)}>${b.eyebrow}</p>`,
    headingId: () => `t-${++headingCount}`,
    // Fundo da seção: o escolhido no bloco ou, em "auto", o padrão do tipo. Sem padrão, claro e
    // cinza se alternam na ordem em que aparecem (contando só as seções automáticas).
    sectionClass(b) {
      const tone = b.background && b.background !== "auto" ? b.background
        : BACKGROUND_DEFAULT[ctx.type] || (sectionCount++ % 2 ? "soft" : "light");
      return `v-section is-${tone}`;
    },
    firstHero: () => heroCount++ === 0,
  };
  return ctx;
}

const RENDERERS = {
  hero(b, ctx) {
    const media = ctx.img(b.image, "v-media", { priority: true });
    const Title = ctx.firstHero() ? "h1" : "h2"; // só um <h1> por página
    const title = b.title || ctx.product.title;
    const titleField = ctx.field("title", b.title, { fallback: true });
    return html`<section class="v-hero"${ctx.mark()}>
  <div class="container v-hero-grid${media ? "" : " no-media"}">
    <div>
      ${ctx.img(b.logo, "v-logo", { priority: true })}
      ${ctx.eyebrow(b)}
      ${Title === "h1" ? html`<h1${titleField}>${title}</h1>` : html`<h2${titleField}>${title}</h2>`}
      ${ctx.show(b.lead) && html`<p class="lead"${ctx.field("lead", b.lead)}>${b.lead}</p>`}
      ${b.badges.length > 0 && html`<ul class="badges" aria-label="Resumo do material">${b.badges.map((x, i) => html`<li>${ctx.show(x.strong) && html`<strong${ctx.field(`badges.${i}.strong`, x.strong)}>${x.strong}</strong>`} ${ctx.text(`badges.${i}.text`, x.text)}</li>`)}</ul>`}
      <div class="offer">${ctx.price(b.price_label, "price_label")}${ctx.cta(b.cta_label, "Comprar agora", "cta_label")}</div>
    </div>
    ${media}
  </div>
</section>`;
  },

  benefits(b, ctx) {
    if (!b.items.length) return null;
    const id = ctx.headingId();
    return html`<section class="${ctx.sectionClass(b)}" aria-labelledby="${id}"${ctx.mark()}><div class="container">
  <h2 id="${id}" class="sr-only">${b.title || "Benefícios"}</h2>
  <div class="two">${b.items.map((x, i) => html`<article class="v-card">${svg(x.icon)}<h3${ctx.field(`items.${i}.title`, x.title)}>${x.title}</h3>${ctx.paras(`items.${i}.text`, x.text)}${ctx.show(x.callout) && html`<p class="callout"${ctx.field(`items.${i}.callout`, x.callout)}>${x.callout}</p>`}</article>`)}</div>
</div></section>`;
  },

  topics(b, ctx) {
    if (!b.items.length) return null;
    const id = ctx.headingId();
    return html`<section class="${ctx.sectionClass(b)}" aria-labelledby="${id}"${ctx.mark()}><div class="container">
  ${ctx.eyebrow(b)}<h2 id="${id}"${ctx.field("title", b.title)}>${b.title}</h2>
  <ul class="grid8">${b.items.map((x, i) => html`<li>${svg(x.icon)}<strong${ctx.field(`items.${i}.title`, x.title)}>${x.title}</strong><span${ctx.field(`items.${i}.text`, x.text)}>${x.text}</span></li>`)}</ul>
</div></section>`;
  },

  gallery(b, ctx) {
    const slides = b.images.map((x) => ctx.img(x.image, "slide-img")).filter(Boolean);
    if (!slides.length) return null;
    const id = ctx.headingId();
    return html`<section class="${ctx.sectionClass(b)}" aria-labelledby="${id}"${ctx.mark()}><div class="container">
  ${ctx.eyebrow(b)}<h2 id="${id}"${ctx.field("title", b.title)}>${b.title}</h2>
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
    return html`<section class="${ctx.sectionClass(b)}" aria-labelledby="${id}"${ctx.mark()}><div class="container narrow">
  <div class="v-card center">${svg(b.icon, "ico big")}${ctx.eyebrow(b)}<h2 id="${id}"${ctx.field("title", b.title)}>${b.title}</h2>
    <ul class="mini">${b.items.map((x, i) => html`<li class="${x.positive ? "yes" : "no"}">${mark(x.positive)}${ctx.text(`items.${i}.text`, x.text)}</li>`)}</ul>
  </div>
</div></section>`;
  },

  comparison(b, ctx) {
    const id = ctx.headingId();
    const side = (prefix, title, items, positive) => html`<article class="v-card${positive ? " dark" : ""}"><h3${ctx.field(`${prefix}_title`, title)}>${title}</h3>
      <ul class="mini">${items.map((x, i) => html`<li class="${positive ? "yes" : "no"}">${mark(positive)}${ctx.text(`${prefix}_items.${i}.text`, x.text)}</li>`)}</ul></article>`;
    return html`<section class="${ctx.sectionClass(b)}" aria-labelledby="${id}"${ctx.mark()}><div class="container">
  ${ctx.eyebrow(b)}<h2 id="${id}"${ctx.field("title", b.title)}>${b.title}</h2>
  <div class="versus">${side("left", b.left_title, b.left_items, false)}<div class="vs" aria-hidden="true">VS</div>${side("right", b.right_title, b.right_items, true)}</div>
</div></section>`;
  },

  author(b, ctx) {
    if (!b.name) return null;
    const id = ctx.headingId();
    const photo = ctx.img(b.photo, "author-photo");
    return html`<section class="${ctx.sectionClass(b)}" aria-labelledby="${id}"${ctx.mark()}><div class="container author${photo ? "" : " no-media"}">
  ${photo}
  <div>${ctx.eyebrow(b)}<h2 id="${id}"${ctx.field("name", b.name)}>${b.name}</h2>${ctx.show(b.role) && html`<p class="muted"><strong${ctx.field("role", b.role)}>${b.role}</strong></p>`}${ctx.paras("bio", b.bio)}</div>
</div></section>`;
  },

  audience(b, ctx) {
    if (!b.items.length) return null;
    const id = ctx.headingId();
    return html`<section class="${ctx.sectionClass(b)}" aria-labelledby="${id}"${ctx.mark()}><div class="container">
  ${ctx.eyebrow(b)}<h2 id="${id}"${ctx.field("title", b.title)}>${b.title}</h2>
  <ul class="who">${b.items.map((x, i) => html`<li>${svg(x.icon)}${ctx.text(`items.${i}.text`, x.text)}</li>`)}</ul>
</div></section>`;
  },

  highlight(b, ctx) {
    const id = ctx.headingId();
    return html`<section class="${ctx.sectionClass(b)}" aria-labelledby="${id}"${ctx.mark()}><div class="container">
  <div class="banner">
    <div>${ctx.eyebrow(b)}<h2 id="${id}"${ctx.field("title", b.title)}>${b.title}</h2>${ctx.paras("text", b.text)}</div>
    ${b.items.length > 0 && html`<ul class="mini">${b.items.map((x, i) => html`<li class="yes">${mark(true)}${ctx.text(`items.${i}.text`, x.text)}</li>`)}</ul>`}
  </div>
</div></section>`;
  },

  // Faixa compacta de compra no meio da página: texto à esquerda, preço e botão à direita.
  cta(b, ctx) {
    const price = ctx.product.price_cents === null || ctx.product.price_cents === undefined ? null
      : html`<span class="v-strip-price">${brl(ctx.product.price_cents)}</span>`;
    return html`<section class="v-strip" aria-label="Chamada para compra"${ctx.mark()}><div class="container v-strip-row">
  <div>${ctx.eyebrow(b)}${ctx.show(b.title) && html`<p class="v-strip-text"${ctx.field("title", b.title)}>${b.title}</p>`}</div>
  <div class="v-strip-action">${price}${ctx.cta(b.cta_label, "Quero garantir", "cta_label")}</div>
</div></section>`;
  },

  testimonials(b, ctx) {
    // Na página pública só entram depoimentos com texto. No editor aparecem todos (vazio = espaço
    // para digitar); sem nenhum texto, a seção leva data-hidden ("não aparece na página").
    const filled = b.items.some((x) => x.quote);
    const items = b.items.map((x, i) => [x, i]).filter(([x]) => ctx.live || x.quote);
    if (!items.length) return null;
    const id = ctx.headingId();
    return html`<section class="${ctx.sectionClass(b)}" aria-labelledby="${id}"${ctx.mark({ hidden: !filled })}><div class="container">
  ${ctx.eyebrow(b)}<h2 id="${id}"${ctx.field("title", b.title)}>${b.title}</h2>
  <div class="quotes">${items.map(([x, i]) => html`<figure class="v-quote">
    <blockquote>${ctx.paras(`items.${i}.quote`, x.quote)}</blockquote>
    <figcaption>${ctx.img(x.photo, "quote-photo")}<span>${ctx.show(x.name) && html`<strong${ctx.field(`items.${i}.name`, x.name)}>${x.name}</strong>`}${ctx.show(x.role) && html`<span class="muted"${ctx.field(`items.${i}.role`, x.role)}>${x.role}</span>`}</span></figcaption>
  </figure>`)}</div>
</div></section>`;
  },

  faq(b, ctx) {
    if (!b.items.length) return null;
    const id = ctx.headingId();
    // No editor as respostas ficam abertas, para serem editáveis.
    return html`<section class="${ctx.sectionClass(b)}" aria-labelledby="${id}"${ctx.mark()}><div class="container narrow">
  ${ctx.eyebrow(b)}<h2 id="${id}"${ctx.field("title", b.title)}>${b.title}</h2>
  ${b.items.map((x, i) => html`<details class="faq"${ctx.live ? html` open` : null}><summary>${ctx.text(`items.${i}.question`, x.question)}</summary>${ctx.paras(`items.${i}.answer`, x.answer)}</details>`)}
</div></section>`;
  },

  guarantee(b, ctx) {
    const id = ctx.headingId();
    return html`<section class="${ctx.sectionClass(b)}" aria-labelledby="${id}"${ctx.mark()}><div class="container narrow">
  <div class="v-card center">${ctx.eyebrow(b)}<h2 id="${id}"${ctx.field("title", b.title)}>${b.title}</h2>
    ${b.items.length > 0 && html`<ul class="seals">${b.items.map((x, i) => html`<li>${svg(x.icon)}${ctx.text(`items.${i}.text`, x.text)}</li>`)}</ul>`}
  </div>
</div></section>`;
  },

  offer(b, ctx) {
    const id = ctx.headingId();
    const media = ctx.img(b.image, "v-media small");
    return html`<section class="v-final" aria-labelledby="${id}"${ctx.mark()}>
  <div class="container v-hero-grid${media ? "" : " no-media"}">
    ${media}
    <div>${ctx.eyebrow(b)}<h2 id="${id}"${ctx.field("title", b.title, { fallback: true })}>${b.title || ctx.product.title}</h2><div class="offer offer-panel">${ctx.price(b.price_label, "price_label")}${ctx.cta(b.cta_label, "Garantir agora", "cta_label")}</div></div>
  </div>
</section>`;
  },
};

// Por que um bloco não aparece na página (aviso exibido só no editor).
const HIDDEN_REASON = {
  testimonials: "escreva pelo menos um depoimento",
  gallery: "adicione imagens",
  author: "preencha o nome do autor",
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
  const live = preview === "live";
  const ctx = createContext(data, { live });
  const body = cleanBlocks(data.sections).map(({ block, index }) => {
    // Na pré-visualização, cada seção leva data-block="N" (clicar nela abre o bloco N no editor).
    // hidden: a seção só aparece no editor (ex.: depoimentos ainda sem texto) — marcada como oculta.
    ctx.mark = ({ hidden = false } = {}) => (preview ? html` data-block="${index}"${live && hidden ? html` data-hidden` : null}` : null);
    ctx.type = block.type;
    const section = RENDERERS[block.type](block, ctx);
    // No editor, um bloco que não aparece na página vira um aviso selecionável (senão ficaria inalcançável).
    if (!section && live) {
      return html`<section class="editor-hidden-block" data-block="${index}" data-hidden><div class="container">
  <p><strong>${BLOCKS[block.type].label}</strong> — não aparece na página: ${HIDDEN_REASON[block.type] || "preencha o conteúdo principal do bloco"}.</p>
</div></section>`;
    }
    return section;
  }).filter(Boolean);

  const title = data.seo_title || data.title;
  const description = data.seo_description || data.short_description || "";
  const url = `${baseUrl}/p/${data.slug}`;
  const cover = data.media.get(data.image_id);

  return html`<!DOCTYPE html>
<html lang="pt-BR"${live ? html` data-editor` : null}>
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
  <link rel="preload" href="/fonts/inter/InterVariable-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/css/theme.css">
  <link rel="stylesheet" href="/css/style.css">
  <link rel="stylesheet" href="/css/site.css">
  <link rel="stylesheet" href="/css/venda.css">
  ${themeLink(data.theme)}${live && html`
  <link rel="stylesheet" href="/css/venda-editor.css">`}
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
      <div><p><strong data-site="nome"></strong> © <span data-year></span></p><p data-site="slogan"></p></div>
      <div><p><strong>Navegação</strong></p><p><a href="/catalogo.html">Catálogo</a></p><p><a href="/sobre.html">Sobre</a></p><p><a href="/contato.html">Contato</a></p></div>
      <div><p><strong>Compra segura</strong></p><p>Pagamentos e acesso aos cursos processados pela Kiwify.</p></div>
    </div>
  </footer>
</body>
</html>`.toString();
}

module.exports = { renderSalesPage };
