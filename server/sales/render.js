// Monta o HTML da página de vendas a partir dos blocos. A marcação segue a página original do
// Manual (mesmas classes de public/css/venda.css), então o visual é o mesmo.
const { html } = require("../lib/html");
const { BLOCKS, ICONS, NETWORKS, validBlocks } = require("./blocks");
const { normalizeTheme, themeHref, DEFAULT_THEME } = require("./theme");

const brl = (cents) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Textos com várias linhas: cada parágrafo (separado por linha em branco) vira um <p>.
const paragraphs = (text, cls) => (text || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  .map((p) => (cls ? html`<p class="${cls}">${p}</p>` : html`<p>${p}</p>`));

const svg = (name, cls = "ico") => html`<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const mark = (positive) => html`<svg aria-hidden="true"><use href="#i-${positive ? "check" : "x"}"/></svg>`;

// Sprite com os ícones dos blocos (desenhos definidos em blocks.js, compartilhados com o editor)
// e os das redes sociais (#i-net-instagram, ...).
const SPRITE = html`<svg class="svg-sprite" aria-hidden="true">${[
  ...Object.entries(ICONS),
  ...Object.entries(NETWORKS).map(([name, icon]) => [`net-${name}`, icon]),
].map(([name, icon]) =>
  html`<symbol id="i-${name}" viewBox="0 0 24 24"><path d="${icon.d}" fill="none" stroke="currentColor" stroke-width="${icon.width || 1.8}" stroke-linecap="round" stroke-linejoin="round"/></symbol>`)}</svg>`;

// Ícone e nome de um link, adivinhados pelo endereço (botões de link do autor).
const LINK_HOSTS = [
  [/(^|\.)linkedin\.com$/, "net-linkedin", "LinkedIn"],
  [/(^|\.)lattes\.cnpq\.br$/, "cap", "Currículo Lattes"],
  [/(^|\.)instagram\.com$/, "net-instagram", "Instagram"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "net-youtube", "YouTube"],
  [/(^|\.)(wa\.me|whatsapp\.com)$/, "net-whatsapp", "WhatsApp"],
  [/(^|\.)facebook\.com$/, "net-facebook", "Facebook"],
  [/(^|\.)tiktok\.com$/, "net-tiktok", "TikTok"],
  [/(^|\.)(x\.com|twitter\.com)$/, "net-x", "X"],
];
function linkKind(url) {
  if (url.startsWith("mailto:")) return { icon: "net-email", label: "E-mail" };
  let host = "";
  try { host = new URL(url).hostname.toLowerCase(); } catch { /* vazio ou incompleto: ícone de site */ }
  const hit = LINK_HOSTS.find(([re]) => re.test(host));
  return hit ? { icon: hit[1], label: hit[2] } : { icon: "net-site", label: "Site" };
}

// Botão de link de uma lista (links do autor, redes sociais). O texto é editável na página; o
// endereço, no painel do bloco. Na página pública só entram links com endereço (filtrados antes).
function linkItem(ctx, list, i, x, kind) {
  const external = x.url && !x.url.startsWith("mailto:");
  const label = ctx.live
    ? html`<span${ctx.field(`${list}.${i}.label`, x.label, { fallback: true })}>${x.label || kind.label}</span>`
    : x.label || kind.label;
  const target = x.url
    ? html` href="${x.url}"${external ? html` target="_blank" rel="noopener noreferrer"` : null}`
    : html` data-no-url title="Defina o endereço em Configurar bloco ⚙"`;
  return html`<li${ctx.item(list, i)}><a class="link-btn"${target}>${svg(kind.icon, "link-ico")}${label}${external ? html`<span class="sr-only"> (abre em nova aba)</span>` : null}</a>${ctx.remove(list, i)}</li>`;
}

// Campo do esquema pelo caminho ("items.0.question" -> o campo "Pergunta"): rótulo do texto de
// exemplo e tamanho recomendado das imagens.
function schemaField(type, path) {
  let fields = BLOCKS[type]?.fields, field = null;
  for (const part of path.split(".")) {
    if (/^\d+$/.test(part)) continue;
    field = fields?.[part];
    fields = field?.item;
  }
  return field;
}
const fieldLabel = (type, path) => schemaField(type, path)?.label || "";

// Desenho do espaço de imagem vazia no editor (moldura com montanha e sol).
const IMAGE_GLYPH = html`<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

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
    // Ícone de um campo "icon". No editor leva data-icon-field (clicar nele abre a escolha de ícone).
    icon(path, name, cls = "ico") {
      if (!live) return svg(name, cls);
      return html`<svg class="${cls}" aria-hidden="true" data-icon-field="${path}"><use href="#i-${name}"/></svg>`;
    },
    // Campo opcional: na página pública só aparece preenchido; no editor, sempre (vazio = espaço para digitar).
    show: (value) => live || !!value,

    // <img> de uma imagem da biblioteca; "priority" para a primeira dobra (não espera rolar).
    // No editor (com path, o caminho do campo): a imagem leva data-image-field (clicar troca) e,
    // sem imagem, aparece um espaço clicável com o tamanho recomendado. optional: esse espaço só
    // aparece no bloco selecionado (como os textos vazios), para não pesar na prévia.
    img(id, cls, { priority = false, path = null, optional = false } = {}) {
      const m = id && data.media.get(id);
      const editable = live && path;
      if (!m) return editable ? ctx.imageSlot(cls, path, { optional }) : null;
      return html`<img class="${cls}" src="${m.url}" alt="${m.alt_text || ""}" width="${m.width}" height="${m.height}" ${priority ? html`fetchpriority="high"` : html`loading="lazy"`} decoding="async"${editable ? html` data-image-field="${path}"` : null}>`;
    },
    // Espaço de imagem vazia (só no editor). add: lista onde a imagem escolhida entra (galeria).
    imageSlot(cls, path, { optional = false, add = null } = {}) {
      const field = schemaField(ctx.type, path);
      const size = field?.size ? `${field.size}${field.tip ? ` · ${field.tip}` : ""}` : "";
      const attr = add ? html` data-image-add="${add}"` : html` data-image-field="${path}"`;
      return html`<span class="img-slot ${cls}"${attr}${optional ? html` data-empty` : null} title="Adicionar imagem${size ? ` (${size})` : ""}">${IMAGE_GLYPH}<strong>Adicionar imagem</strong>${size && html`<small>Tamanho recomendado: ${size}</small>`}</span>`;
    },
    /* ---- Itens das listas, direto na página (só no editor) ---- */
    // Atributo do item: data-item="items.3" (caminho do item dentro do bloco).
    item: (list, i) => (live ? html` data-item="${list}.${i}"` : null),
    // Botão × que remove o item (aparece ao passar o mouse, no bloco selecionado).
    remove(list, i) {
      if (!live) return null;
      const noun = BLOCKS[ctx.type].fields[list].noun;
      return html`<button type="button" class="item-remove" data-item-remove="${list}.${i}" aria-label="Remover ${noun} ${i + 1}" title="Remover ${noun}">${svg("x", "item-remove-ico")}</button>`;
    },
    // Fim da lista: botão "+ Adicionar <item>" (no bloco selecionado, enquanto cabe mais um).
    // tag: "li" dentro de <ul>; "div" nas grades de <article>, <details> e <figure>.
    addItem(list, items, tag = "li") {
      const field = BLOCKS[ctx.type].fields[list];
      if (!live || items.length >= field.max) return null;
      const button = html`<button type="button" class="item-add-btn" data-item-add="${list}">+ Adicionar ${field.noun}</button>`;
      return tag === "li" ? html`<li class="item-add">${button}</li>` : html`<div class="item-add">${button}</div>`;
    },
    // Botão de compra: o link vem SEMPRE do cadastro do produto (fonte única).
    // label: texto do bloco (vazio = usa o fallback); path: o campo, para a edição no editor.
    // icon: ícone antes do texto (ex.: o cadeado do cartão de compra).
    cta(label, fallback, path, { icon = null } = {}) {
      if (!data.checkout_url) return html`<span class="btn-cta is-disabled" aria-disabled="true">Em breve</span>`;
      const text = live ? html`<span${ctx.field(path, label, { fallback: true })}>${label || fallback}</span>` : label || fallback;
      return html`<a class="btn-cta" href="${data.checkout_url}" target="_blank" rel="noopener noreferrer">${icon && svg(icon, "cta-ico")}${text}<span class="sr-only"> (abre em nova aba)</span></a>`;
    },
    price(label, path) {
      if (data.price_cents === null || data.price_cents === undefined) return null;
      return html`<p class="price-big">${ctx.show(label) && html`<span class="muted-on-dark"${ctx.field(path, label)}>${label}</span>`} ${brl(data.price_cents)}</p>`;
    },
    // Rótulo curto em caixa alta acima do título (opcional).
    eyebrow: (b) => ctx.show(b.eyebrow) && html`<p class="v-eyebrow"${ctx.field("eyebrow", b.eyebrow)}>${b.eyebrow}</p>`,
    // Descrição curta e centralizada abaixo do título da seção (opcional).
    intro: (b) => ctx.show(b.intro) && html`<p class="v-intro"${ctx.field("intro", b.intro)}>${b.intro}</p>`,
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

// Links do autor (Lattes, LinkedIn, site…) abaixo da biografia. Página pública: só os com endereço.
function authorLinks(b, ctx) {
  const links = b.links.map((x, i) => [x, i]).filter(([x]) => ctx.live || x.url);
  if (!links.length && !ctx.live) return null;
  return html`<ul class="link-list author-links">${links.map(([x, i]) => linkItem(ctx, "links", i, x, linkKind(x.url)))}${ctx.addItem("links", b.links)}</ul>`;
}

const RENDERERS = {
  hero(b, ctx) {
    const media = ctx.img(b.image, "v-media", { priority: true, path: "image" });
    const Title = ctx.firstHero() ? "h1" : "h2"; // só um <h1> por página
    const title = b.title || ctx.product.title;
    const titleField = ctx.field("title", b.title, { fallback: true });
    return html`<section class="v-hero"${ctx.mark()}>
  <div class="container v-hero-grid${media ? "" : " no-media"}">
    <div>
      ${ctx.img(b.logo, "v-logo", { priority: true, path: "logo", optional: true })}
      ${ctx.eyebrow(b)}
      ${Title === "h1" ? html`<h1${titleField}>${title}</h1>` : html`<h2${titleField}>${title}</h2>`}
      ${ctx.show(b.lead) && html`<p class="lead"${ctx.field("lead", b.lead)}>${b.lead}</p>`}
      ${(b.badges.length > 0 || ctx.live) && html`<ul class="badges" aria-label="Resumo do material">${b.badges.map((x, i) => html`<li${ctx.item("badges", i)}>${ctx.show(x.strong) && html`<strong${ctx.field(`badges.${i}.strong`, x.strong)}>${x.strong}</strong>`} ${ctx.text(`badges.${i}.text`, x.text)}${ctx.remove("badges", i)}</li>`)}${ctx.addItem("badges", b.badges)}</ul>`}
      <div class="offer">${ctx.price(b.price_label, "price_label")}${ctx.cta(b.cta_label, "Comprar agora", "cta_label")}</div>
    </div>
    ${media}
  </div>
</section>`;
  },

  benefits(b, ctx) {
    // Lista vazia: some da página; no editor fica só com o botão de adicionar.
    if (!b.items.length && !ctx.live) return null;
    const id = ctx.headingId();
    return html`<section class="${ctx.sectionClass(b)}" aria-labelledby="${id}"${ctx.mark({ hidden: !b.items.length })}><div class="container">
  <h2 id="${id}" class="sr-only">${b.title || "Benefícios"}</h2>
  <div class="two">${b.items.map((x, i) => html`<article class="v-card"${ctx.item("items", i)}>${ctx.icon(`items.${i}.icon`, x.icon)}<h3${ctx.field(`items.${i}.title`, x.title)}>${x.title}</h3>${ctx.paras(`items.${i}.text`, x.text)}${ctx.show(x.callout) && html`<p class="callout"${ctx.field(`items.${i}.callout`, x.callout)}>${x.callout}</p>`}${ctx.remove("items", i)}</article>`)}${ctx.addItem("items", b.items, "div")}</div>
</div></section>`;
  },

  topics(b, ctx) {
    if (!b.items.length && !ctx.live) return null;
    const id = ctx.headingId();
    return html`<section class="${ctx.sectionClass(b)}" aria-labelledby="${id}"${ctx.mark({ hidden: !b.items.length })}><div class="container">
  ${ctx.eyebrow(b)}<h2 id="${id}"${ctx.field("title", b.title)}>${b.title}</h2>${ctx.intro(b)}
  <ul class="grid8">${b.items.map((x, i) => html`<li${ctx.item("items", i)}>${ctx.icon(`items.${i}.icon`, x.icon)}<strong${ctx.field(`items.${i}.title`, x.title)}>${x.title}</strong><span${ctx.field(`items.${i}.text`, x.text)}>${x.text}</span>${ctx.remove("items", i)}</li>`)}${ctx.addItem("items", b.items)}</ul>
</div></section>`;
  },

  gallery(b, ctx) {
    const slides = b.images.map((x, i) => ({ img: ctx.img(x.image, "slide-img", { path: `images.${i}.image` }), i })).filter((s) => s.img);
    // No editor, um último slide "Adicionar imagem" (a escolhida entra no fim da lista). Sem nenhuma
    // imagem a galeria não aparece na página, mas no editor fica só com esse slide, para começar.
    const filled = b.images.some((x) => ctx.product.media.get(x.image));
    if (ctx.live && b.images.length < BLOCKS.gallery.fields.images.max) slides.push({ img: ctx.imageSlot("slide-img", "images.0.image", { add: "images" }), i: null });
    if (!slides.length) return null;
    const id = ctx.headingId();
    return html`<section class="${ctx.sectionClass(b)}" aria-labelledby="${id}"${ctx.mark({ hidden: !filled })}><div class="container">
  ${ctx.eyebrow(b)}<h2 id="${id}"${ctx.field("title", b.title)}>${b.title}</h2>${ctx.intro(b)}
  <div class="carousel" role="region" aria-roledescription="carrossel" aria-labelledby="${id}">
    <button class="car-btn prev" type="button" aria-label="Slide anterior" hidden>‹</button>
    <ul class="track">${slides.map((s, n) => html`<li class="slide" aria-label="Slide ${n + 1} de ${slides.length}"${s.i !== null && ctx.item("images", s.i)}>${s.img}${s.i !== null && ctx.remove("images", s.i)}</li>`)}</ul>
    <button class="car-btn next" type="button" aria-label="Próximo slide" hidden>›</button>
    <div class="dots" hidden></div>
  </div>
</div></section>`;
  },

  checklist(b, ctx) {
    if (!b.items.length && !ctx.live) return null;
    const id = ctx.headingId();
    return html`<section class="${ctx.sectionClass(b)}" aria-labelledby="${id}"${ctx.mark({ hidden: !b.items.length })}><div class="container narrow">
  <div class="v-card center">${ctx.icon("icon", b.icon, "ico big")}${ctx.eyebrow(b)}<h2 id="${id}"${ctx.field("title", b.title)}>${b.title}</h2>${ctx.intro(b)}
    <ul class="mini">${b.items.map((x, i) => html`<li class="${x.positive ? "yes" : "no"}"${ctx.item("items", i)}>${mark(x.positive)}${ctx.text(`items.${i}.text`, x.text)}${ctx.remove("items", i)}</li>`)}${ctx.addItem("items", b.items)}</ul>
  </div>
</div></section>`;
  },

  comparison(b, ctx) {
    const id = ctx.headingId();
    const side = (prefix, title, items, positive) => html`<article class="v-card${positive ? " dark" : ""}"><h3${ctx.field(`${prefix}_title`, title)}>${title}</h3>
      <ul class="mini">${items.map((x, i) => html`<li class="${positive ? "yes" : "no"}"${ctx.item(`${prefix}_items`, i)}>${mark(positive)}${ctx.text(`${prefix}_items.${i}.text`, x.text)}${ctx.remove(`${prefix}_items`, i)}</li>`)}${ctx.addItem(`${prefix}_items`, items)}</ul></article>`;
    return html`<section class="${ctx.sectionClass(b)}" aria-labelledby="${id}"${ctx.mark()}><div class="container">
  ${ctx.eyebrow(b)}<h2 id="${id}"${ctx.field("title", b.title)}>${b.title}</h2>${ctx.intro(b)}
  <div class="versus">${side("left", b.left_title, b.left_items, false)}<div class="vs" aria-hidden="true">VS</div>${side("right", b.right_title, b.right_items, true)}</div>
</div></section>`;
  },

  author(b, ctx) {
    if (!b.name) return null;
    const id = ctx.headingId();
    const photo = ctx.img(b.photo, "author-photo", { path: "photo" });
    return html`<section class="${ctx.sectionClass(b)}" aria-labelledby="${id}"${ctx.mark()}><div class="container author${photo ? "" : " no-media"}">
  ${photo}
  <div>${ctx.eyebrow(b)}<h2 id="${id}"${ctx.field("name", b.name)}>${b.name}</h2>${ctx.show(b.role) && html`<p class="muted"><strong${ctx.field("role", b.role)}>${b.role}</strong></p>`}${ctx.paras("bio", b.bio)}${authorLinks(b, ctx)}</div>
</div></section>`;
  },

  audience(b, ctx) {
    if (!b.items.length && !ctx.live) return null;
    const id = ctx.headingId();
    return html`<section class="${ctx.sectionClass(b)}" aria-labelledby="${id}"${ctx.mark({ hidden: !b.items.length })}><div class="container">
  ${ctx.eyebrow(b)}<h2 id="${id}"${ctx.field("title", b.title)}>${b.title}</h2>${ctx.intro(b)}
  <ul class="who">${b.items.map((x, i) => html`<li${ctx.item("items", i)}>${ctx.icon(`items.${i}.icon`, x.icon)}${ctx.text(`items.${i}.text`, x.text)}${ctx.remove("items", i)}</li>`)}${ctx.addItem("items", b.items)}</ul>
</div></section>`;
  },

  highlight(b, ctx) {
    const id = ctx.headingId();
    return html`<section class="${ctx.sectionClass(b)}" aria-labelledby="${id}"${ctx.mark()}><div class="container">
  <div class="banner">
    <div>${ctx.eyebrow(b)}<h2 id="${id}"${ctx.field("title", b.title)}>${b.title}</h2>${ctx.paras("text", b.text)}</div>
    ${(b.items.length > 0 || ctx.live) && html`<ul class="mini">${b.items.map((x, i) => html`<li class="yes"${ctx.item("items", i)}>${mark(true)}${ctx.text(`items.${i}.text`, x.text)}${ctx.remove("items", i)}</li>`)}${ctx.addItem("items", b.items)}</ul>`}
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
    if (!items.length && !ctx.live) return null;
    const id = ctx.headingId();
    return html`<section class="${ctx.sectionClass(b)}" aria-labelledby="${id}"${ctx.mark({ hidden: !filled })}><div class="container">
  ${ctx.eyebrow(b)}<h2 id="${id}"${ctx.field("title", b.title)}>${b.title}</h2>${ctx.intro(b)}
  <div class="quotes">${items.map(([x, i]) => html`<figure class="v-quote"${ctx.item("items", i)}>${ctx.remove("items", i)}
    <blockquote>${ctx.paras(`items.${i}.quote`, x.quote)}</blockquote>
    <figcaption>${ctx.img(x.photo, "quote-photo", { path: `items.${i}.photo`, optional: true })}<span>${ctx.show(x.name) && html`<strong${ctx.field(`items.${i}.name`, x.name)}>${x.name}</strong>`}${ctx.show(x.role) && html`<span class="muted"${ctx.field(`items.${i}.role`, x.role)}>${x.role}</span>`}</span></figcaption>
  </figure>`)}${ctx.addItem("items", b.items, "div")}</div>
</div></section>`;
  },

  faq(b, ctx) {
    if (!b.items.length && !ctx.live) return null;
    const id = ctx.headingId();
    // No editor as respostas ficam abertas, para serem editáveis.
    return html`<section class="${ctx.sectionClass(b)}" aria-labelledby="${id}"${ctx.mark({ hidden: !b.items.length })}><div class="container narrow">
  ${ctx.eyebrow(b)}<h2 id="${id}"${ctx.field("title", b.title)}>${b.title}</h2>${ctx.intro(b)}
  ${b.items.map((x, i) => html`<details class="faq"${ctx.live ? html` open` : null}${ctx.item("items", i)}><summary>${ctx.text(`items.${i}.question`, x.question)}</summary>${ctx.paras(`items.${i}.answer`, x.answer)}${ctx.remove("items", i)}</details>`)}${ctx.addItem("items", b.items, "div")}
</div></section>`;
  },

  guarantee(b, ctx) {
    const id = ctx.headingId();
    return html`<section class="${ctx.sectionClass(b)}" aria-labelledby="${id}"${ctx.mark()}><div class="container narrow">
  <div class="v-card center">${ctx.eyebrow(b)}<h2 id="${id}"${ctx.field("title", b.title)}>${b.title}</h2>${ctx.intro(b)}
    ${(b.items.length > 0 || ctx.live) && html`<ul class="seals">${b.items.map((x, i) => html`<li${ctx.item("items", i)}>${ctx.icon(`items.${i}.icon`, x.icon)}${ctx.text(`items.${i}.text`, x.text)}${ctx.remove("items", i)}</li>`)}${ctx.addItem("items", b.items)}</ul>`}
  </div>
</div></section>`;
  },

  // Oferta final: texto, benefícios e credibilidade à esquerda; cartão de compra à direita.
  // Os cartões opcionais (credibilidade, garantia) só aparecem preenchidos; no editor, vazios,
  // levam data-empty (aparecem só com o bloco selecionado, como os textos vazios).
  offer(b, ctx) {
    const id = ctx.headingId();
    const card = (filled, cls, content) => (filled || ctx.live)
      && html`<div class="${cls}"${!filled ? html` data-empty` : null}>${content}</div>`;
    const pair = (titlePath, title, textPath, text) => html`<p>${ctx.show(title) && html`<strong${ctx.field(titlePath, title)}>${title}</strong>`}${ctx.show(text) && html`<span${ctx.field(textPath, text)}>${text}</span>`}</p>`;
    return html`<section class="v-final" aria-labelledby="${id}"${ctx.mark()}>
  <div class="container offer-grid">
    <div class="offer-main">
      ${ctx.eyebrow(b)}<h2 id="${id}"${ctx.field("title", b.title, { fallback: true })}>${b.title || ctx.product.title}</h2>
      ${ctx.paras("text", b.text, "lead")}
      ${(b.items.length > 0 || ctx.live) && html`<ul class="offer-benefits">${b.items.map((x, i) => html`<li${ctx.item("items", i)}>${ctx.icon(`items.${i}.icon`, x.icon)}${ctx.text(`items.${i}.text`, x.text)}${ctx.remove("items", i)}</li>`)}${ctx.addItem("items", b.items)}</ul>`}
      ${card(b.proof_title || b.proof_text, "offer-proof", html`${ctx.icon("proof_icon", b.proof_icon)}${pair("proof_title", b.proof_title, "proof_text", b.proof_text)}`)}
    </div>
    <div class="buy-card">
      ${ctx.img(b.image, "buy-media", { path: "image", optional: true })}
      ${ctx.price(b.price_label, "price_label")}
      ${(b.conditions.length > 0 || ctx.live) && html`<ul class="mini buy-conditions">${b.conditions.map((x, i) => html`<li class="yes"${ctx.item("conditions", i)}>${mark(true)}${ctx.text(`conditions.${i}.text`, x.text)}${ctx.remove("conditions", i)}</li>`)}${ctx.addItem("conditions", b.conditions)}</ul>`}
      ${card(b.guarantee_title || b.guarantee_text, "buy-guarantee", html`${svg("shield")}${pair("guarantee_title", b.guarantee_title, "guarantee_text", b.guarantee_text)}`)}
      ${ctx.cta(b.cta_label, "Garantir agora", "cta_label", { icon: "lock" })}
      <p class="buy-note"${ctx.field("note", b.note, { fallback: true })}>${b.note || "Pagamento processado com segurança pela Kiwify."}</p>
    </div>
  </div>
</section>`;
  },

  // Redes sociais: botões em pílula centralizados. Página pública: só as redes com link.
  social(b, ctx) {
    const items = b.items.map((x, i) => [x, i]).filter(([x]) => ctx.live || x.url);
    if (!items.length && !ctx.live) return null;
    const id = ctx.headingId();
    return html`<section class="${ctx.sectionClass(b)}" aria-labelledby="${id}"${ctx.mark({ hidden: !b.items.some((x) => x.url) })}><div class="container">
  ${ctx.eyebrow(b)}<h2 id="${id}"${ctx.field("title", b.title, { fallback: true })}>${b.title || "Acompanhe nas redes"}</h2>${ctx.intro(b)}
  <ul class="link-list social-links">${items.map(([x, i]) => linkItem(ctx, "items", i, x, { icon: `net-${x.network}`, label: NETWORKS[x.network].label }))}${ctx.addItem("items", b.items)}</ul>
</div></section>`;
  },
};

// Por que um bloco não aparece na página (aviso exibido só no editor).
const HIDDEN_REASON = {
  testimonials: "escreva pelo menos um depoimento",
  gallery: "adicione imagens",
  author: "preencha o nome do autor",
  social: "coloque o link de pelo menos uma rede",
};

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
  // Blocos inválidos são ignorados um a um; index (posição original) liga a seção ao bloco do editor.
  const body = validBlocks(data.sections).map(({ block, index }) => {
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
  <link rel="icon" type="image/png" href="/assets/favicon/favicon.png">
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
