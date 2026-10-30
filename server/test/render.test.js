// Testes da renderização da página de vendas: a página pública não leva nada do editor, e a
// pré-visualização ao vivo marca os textos editáveis corretamente. Rodar: npm test (node --test)
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { renderSalesPage } = require("../sales/render");
const { BLOCKS, defaultSections } = require("../sales/blocks");

const product = (sections) => ({
  title: "Produto de Teste", slug: "produto-teste", short_description: "", status: "published",
  price_cents: 4990, checkout_url: "https://pay.example.com/x", image_id: null,
  sections, brand_name: null, brand_logo_id: null, theme: null, published_at: null, media: new Map(),
});
const render = (sections, preview) => renderSalesPage(product(sections), { baseUrl: "http://localhost", preview });

// Uma página com todos os tipos, campos vazios, blocos ocultos e texto perigoso.
const sample = () => [
  ...defaultSections(),
  { type: "hero", title: "", lead: "", badges: [{ strong: "", text: "x" }] },
  { type: "author", name: "" },                                     // não aparece: sem nome
  { type: "testimonials", title: "Dizem", items: [{ quote: "Q", name: "N", role: "" }, { quote: "" }] },
  { type: "benefits", items: [{ title: "<script>alert(1)</script>", text: "P1\n\nP2", callout: "" }] },
];

// Cada seção da pré-visualização com o número do bloco: [[índice, html], ...]
function sectionsOf(page) {
  return page.split(/(?=<section[^>]*data-block=")/).slice(1)
    .map((chunk) => [Number(/data-block="(\d+)"/.exec(chunk)[1]), chunk.split("</section>")[0]]);
}

// Campo do esquema a partir do caminho dentro do bloco ("items.0.question").
function schemaField(type, path) {
  let fields = BLOCKS[type].fields, field;
  for (const part of path.split(".")) {
    if (/^\d+$/.test(part)) continue;
    field = fields[part];
    fields = field?.item;
  }
  return field;
}

test("página pública não tem nenhuma marcação do editor", () => {
  for (const preview of [false, true]) {
    const page = render(sample(), preview);
    for (const marker of ["data-field", "data-empty", "data-hidden", "data-fallback", "data-multiline", "venda-editor.css", "editor-hidden-block", "data-editor", "data-icon-field"]) {
      assert.ok(!page.includes(marker), `"${marker}" apareceu com preview=${preview}`);
    }
  }
  assert.ok(!render(sample(), false).includes("data-block"));
});

test("modo ao vivo carrega o CSS do editor", () => {
  assert.match(render(sample(), "live"), /href="\/css\/venda-editor\.css(\?v=[\w-]+)?"/); // com ?v= quando o arquivo existe
});

test("todo data-field aponta para um campo de texto do bloco certo", () => {
  const sections = sample();
  let count = 0;
  for (const [index, chunk] of sectionsOf(render(sections, "live"))) {
    for (const [, path] of chunk.matchAll(/data-field="([^"]+)"/g)) {
      const field = schemaField(sections[index].type, path);
      assert.ok(field && ["text", "textarea"].includes(field.type), `bloco ${index} (${sections[index].type}): "${path}" não é texto`);
      count++;
    }
  }
  assert.ok(count > 40, `poucos campos marcados (${count})`);
});

test("cada texto preenchido do modelo padrão é editável na página", () => {
  const sections = defaultSections();
  const marked = new Map(sectionsOf(render(sections, "live")).map(([i, chunk]) =>
    [i, new Set([...chunk.matchAll(/data-field="([^"]+)"/g)].map((m) => m[1]))]));
  const missing = [];
  sections.forEach((block, i) => {
    const walk = (value, fields, prefix) => {
      for (const [name, field] of Object.entries(fields)) {
        const path = prefix + name;
        if (field.type === "list") value[name].forEach((item, j) => walk(item, field.item, `${path}.${j}.`));
        else if (["text", "textarea"].includes(field.type) && value[name] && !marked.get(i)?.has(path)) missing.push(`${block.type}:${path}`);
      }
    };
    walk(block, BLOCKS[block.type].fields, "");
  });
  // Exceções conhecidas: o título dos benefícios é só para leitores de tela, e a galeria do modelo
  // não tem imagens (não aparece; o editor mostra o aviso e o título e o rótulo ficam no painel).
  assert.deepEqual(missing.filter((m) => !["benefits:title", "gallery:title", "gallery:eyebrow"].includes(m)), []);
});

test("campos vazios ganham texto de exemplo com o rótulo do esquema", () => {
  const page = render([{ type: "hero", lead: "", badges: [{ strong: "", text: "x" }] }], "live");
  assert.match(page, /<p class="lead" data-field="lead" data-empty data-placeholder="Chamada"><\/p>/);
  assert.match(page, /data-field="badges\.0\.strong" data-empty data-placeholder="Destaque"/);
});

test("título vazio mostra o do produto, marcado como padrão (não vazio)", () => {
  const page = render([{ type: "hero", title: "" }], "live");
  assert.match(page, /<h1 data-field="title" data-fallback>Produto de Teste<\/h1>/);
  assert.match(page, /<span data-field="cta_label" data-fallback>Comprar agora<\/span>/);
});

test("bloco que não aparece vira aviso selecionável no editor, e some na página pública", () => {
  const sections = [{ type: "hero" }, { type: "author", name: "" }, { type: "gallery", images: [] }];
  const live = render(sections, "live");
  assert.match(live, /data-block="1" data-hidden/);
  assert.match(live, /data-block="2" data-hidden/);
  assert.match(live, /Autor<\/strong> — não aparece na página: preencha o nome do autor/);
  assert.ok(!render(sections, true).includes('data-block="1"'));
});

test("texto digitado continua escapado no modo ao vivo", () => {
  const page = render(sample(), "live");
  assert.ok(page.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(!page.includes("<script>alert(1)"));
});

test("texto longo: parágrafos dentro de um único campo editável", () => {
  const page = render([{ type: "benefits", items: [{ title: "T", text: "P1\n\nP2" }] }], "live");
  assert.match(page, /<div data-field="items\.0\.text" data-multiline><p>P1<\/p><p>P2<\/p><\/div>/);
});

test("FAQ fica aberto no editor e fechado na página pública", () => {
  const sections = [{ type: "faq", items: [{ question: "Q", answer: "A" }] }];
  assert.match(render(sections, "live"), /<details class="faq" open data-item="items\.0">/);
  assert.match(render(sections, false), /<details class="faq">/);
});

test("depoimentos: página pública mostra só os que têm texto", () => {
  const sections = [{ type: "testimonials", title: "Dizem", items: [{ quote: "Mudou meu trabalho.\n\nRecomendo.", name: "Ana", role: "Contadora" }, { quote: "", name: "Sem texto" }] }];
  const page = render(sections, false);
  assert.match(page, /<figure class="v-quote">\s*<blockquote><p>Mudou meu trabalho\.<\/p><p>Recomendo\.<\/p><\/blockquote>/);
  assert.match(page, /<strong>Ana<\/strong><span class="muted">Contadora<\/span>/);
  assert.ok(!page.includes("Sem texto"));
});

test("depoimentos: sem nenhum texto, some da página e aparece marcado no editor", () => {
  const sections = [{ type: "testimonials", items: [{ quote: "" }] }];
  assert.ok(!render(sections, false).includes("v-quote"));
  const live = render(sections, "live");
  assert.match(live, /data-block="0" data-hidden/);
  assert.match(live, /data-field="items\.0\.quote" data-empty data-placeholder="Depoimento" data-multiline/);
  // Lista vazia: no editor a seção continua (oculta), com o botão de adicionar o primeiro.
  const empty = render([{ type: "testimonials", items: [] }], "live");
  assert.match(empty, /data-block="0" data-hidden/);
  assert.match(empty, /data-item-add="items">\+ Adicionar depoimento</);
});

test("depoimentos: foto da biblioteca vira <img> redonda com texto alternativo", () => {
  const photo = "11111111-1111-4111-8111-111111111111";
  const data = product([{ type: "testimonials", items: [{ quote: "Bom.", name: "Ana", photo }] }]);
  data.media = new Map([[photo, { url: "/uploads/ana.webp", alt_text: "Foto de Ana", width: 200, height: 200 }]]);
  const page = renderSalesPage(data, { baseUrl: "http://localhost", preview: false });
  assert.match(page, /<figcaption><img class="quote-photo" src="\/uploads\/ana\.webp" alt="Foto de Ana" width="200" height="200" loading="lazy" decoding="async"><span><strong>Ana<\/strong><\/span><\/figcaption>/);
});

test("fundo: automático alterna claro e cinza; o autor é escuro; a escolha do bloco vale", () => {
  const page = render([
    { type: "faq", items: [{ question: "Q", answer: "A" }] },
    { type: "author", name: "Ana" },
    { type: "faq", items: [{ question: "Q", answer: "A" }] },
    { type: "faq", items: [{ question: "Q", answer: "A" }], background: "dark" },
    { type: "faq", items: [{ question: "Q", answer: "A" }], background: "light" },
  ], false);
  const tones = [...page.matchAll(/<section class="v-section is-(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(tones, ["light", "dark", "soft", "dark", "light"]);
});

test("rótulo acima do título: só aparece preenchido na página pública; no editor, editável", () => {
  assert.match(render([{ type: "faq", eyebrow: "Dúvidas", title: "T", items: [{ question: "Q" }] }], false), /<p class="v-eyebrow">Dúvidas<\/p><h2/);
  assert.ok(!render([{ type: "faq", eyebrow: "", title: "T", items: [{ question: "Q" }] }], false).includes("v-eyebrow"));
  assert.match(render([{ type: "faq", eyebrow: "", title: "T", items: [{ question: "Q" }] }], "live"),
    /<p class="v-eyebrow" data-field="eyebrow" data-empty data-placeholder="Rótulo acima do título"><\/p>/);
});

test("chamada intermediária: texto, preço e botão com o link do produto", () => {
  const page = render([{ type: "cta", title: "Pronto para começar?", cta_label: "" }], false);
  assert.match(page, /<section class="v-strip" aria-label="Chamada para compra">/);
  assert.match(page, /<p class="v-strip-text">Pronto para começar\?<\/p>/);
  assert.match(page, /<span class="v-strip-price">R\$\s49,90<\/span>/);
  assert.match(page, /<a class="btn-cta" href="https:\/\/pay\.example\.com\/x"[^>]*>Quero garantir<span class="sr-only">/);
});

test("editor: <html data-editor> desliga as animações; fonte Inter pré-carregada do próprio site", () => {
  assert.match(render(sample(), "live"), /<html lang="pt-BR" data-editor>/);
  assert.match(render(sample(), false), /<html lang="pt-BR">/);
  assert.match(render(sample(), false), /<link rel="preload" href="\/fonts\/inter\/InterVariable-latin\.woff2" as="font" type="font\/woff2" crossorigin>/);
});

test("ícones: no editor levam o caminho do campo (clique troca o ícone); na página pública, não", () => {
  const sections = [{ type: "benefits", items: [{ icon: "gift", title: "T" }] }, { type: "checklist", icon: "shield", title: "C", items: [{ text: "x", positive: true }] }];
  const live = render(sections, "live");
  assert.match(live, /<svg class="ico" aria-hidden="true" data-icon-field="items\.0\.icon"><use href="#i-gift"\/><\/svg>/);
  assert.match(live, /<svg class="ico big" aria-hidden="true" data-icon-field="icon"><use href="#i-shield"\/><\/svg>/);
  assert.match(render(sections, false), /<svg class="ico" aria-hidden="true"><use href="#i-gift"\/><\/svg>/);
});

test("todo data-icon-field aponta para um campo de ícone do bloco certo", () => {
  const sections = [...defaultSections(), { type: "benefits", items: [{ icon: "gift", title: "T" }] }];
  let count = 0;
  for (const [index, chunk] of sectionsOf(render(sections, "live"))) {
    for (const [, path] of chunk.matchAll(/data-icon-field="([^"]+)"/g)) {
      assert.equal(schemaField(sections[index].type, path)?.type, "icon", `bloco ${index}: ${path}`);
      count++;
    }
  }
  assert.ok(count > 8, `poucos ícones marcados (${count})`);
});

const M1 = "0b6f7a52-9c1e-4d3a-8f2b-5e6c7d8e9f01";
test("imagens: no editor, clicáveis e com espaço vazio mostrando o tamanho recomendado", () => {
  const media = new Map([[M1, { url: "/uploads/a.webp", alt_text: "Capa", width: 1200, height: 900 }]]);
  const sections = [
    { type: "hero", title: "T", image: null, logo: null },
    { type: "author", name: "Ana", photo: M1 },
    { type: "gallery", title: "G", images: [{ image: M1 }] },
    { type: "testimonials", items: [{ quote: "Q", name: "N", photo: null }] },
  ];
  const live = renderSalesPage({ ...product(sections), media }, { baseUrl: "http://localhost", preview: "live" });
  assert.match(live, /<span class="img-slot v-media" data-image-field="image" title="[^"]*1200 × 900 px[^"]*">/);
  assert.match(live, /Tamanho recomendado: 1200 × 900 px/);
  assert.ok(!/v-hero-grid no-media/.test(live), "no editor a abertura reserva o espaço da imagem");
  assert.match(live, /class="img-slot v-logo" data-image-field="logo" data-empty/); // opcional: só no bloco selecionado
  assert.match(live, /<img class="author-photo"[^>]* data-image-field="photo">/);
  assert.match(live, /<img class="slide-img"[^>]* data-image-field="images\.0\.image">/);
  assert.match(live, /data-image-add="images"/);
  assert.match(live, /class="img-slot quote-photo" data-image-field="items\.0\.photo" data-empty/);
  // Todo data-image-field aponta para um campo de imagem do esquema.
  for (const [index, chunk] of sectionsOf(live)) {
    for (const [, path] of chunk.matchAll(/data-image-field="([^"]+)"/g)) {
      assert.equal(schemaField(sections[index].type, path)?.type, "image", `${sections[index].type}:${path}`);
    }
  }
  const pub = renderSalesPage({ ...product(sections), media }, { baseUrl: "http://localhost", preview: false });
  assert.ok(!/img-slot|data-image-field|data-image-add|Tamanho recomendado/.test(pub));
  assert.match(pub, /v-hero-grid no-media/);
});

test("galeria sem imagens: no editor só o espaço para adicionar, marcada como oculta", () => {
  const live = render([{ type: "gallery", title: "G", images: [] }], "live");
  assert.match(live, /data-block="0" data-hidden/);
  assert.match(live, /<li class="slide"[^>]*><span class="img-slot slide-img" data-image-add="images"/);
  assert.match(live, /1500 × 1000 px/);
  assert.ok(!render([{ type: "gallery", title: "G", images: [] }], false).includes("carousel"));
});

test("imagens: todo campo de imagem tem tamanho recomendado", () => {
  for (const [type, block] of Object.entries(BLOCKS)) {
    for (const [name, field] of Object.entries(block.fields)) {
      const fields = field.type === "list" ? Object.entries(field.item) : [[name, field]];
      for (const [n, f] of fields) if (f.type === "image") assert.match(f.size || "", /^\d+ × \d+ px$/, `${type}.${n}`);
    }
  }
});

test("descrição abaixo do título: centralizada após o h2, só preenchida na página pública", () => {
  const types = Object.entries(BLOCKS).filter(([, b]) => b.fields.intro).map(([t]) => t);
  assert.deepEqual(types.sort(), ["audience", "checklist", "comparison", "faq", "gallery", "guarantee", "social", "testimonials", "topics"]);
  const sections = [{ type: "faq", title: "Dúvidas", intro: "Tudo o que você precisa saber.", items: [{ question: "Q", answer: "A" }] }];
  assert.match(render(sections, false), /Dúvidas<\/h2><p class="v-intro">Tudo o que você precisa saber\.<\/p>/);
  assert.match(render(sections, "live"), /<p class="v-intro" data-field="intro">Tudo o que você precisa saber\.<\/p>/);
  const empty = [{ type: "faq", title: "Dúvidas", items: [{ question: "Q", answer: "A" }] }];
  assert.ok(!render(empty, false).includes("v-intro"));
  assert.match(render(empty, "live"), /<p class="v-intro" data-field="intro" data-empty data-placeholder="Descrição abaixo do título">/);
});

// Um bloco de cada tipo com listas, cada lista com um item preenchido.
const listBlocks = () => Object.entries(BLOCKS).filter(([type, b]) => type !== "gallery" && Object.values(b.fields).some((f) => f.type === "list"))
  .map(([type, b]) => {
    const block = { type, [b.fields.title ? "title" : "name"]: "T" }; // o autor só aparece com nome
    for (const [name, field] of Object.entries(b.fields)) {
      if (field.type !== "list") continue;
      const item = {};
      for (const [n, f] of Object.entries(field.item)) if (f.type === "text" || f.type === "textarea") item[n] = "x";
      block[name] = [item];
    }
    return block;
  });

test("listas: no editor, cada item tem × e cada lista tem '+ Adicionar …'", () => {
  for (const block of listBlocks()) {
    const live = render([block], "live");
    for (const [name, field] of Object.entries(BLOCKS[block.type].fields)) {
      if (field.type !== "list") continue;
      assert.ok(live.includes(`data-item="${name}.0"`), `${block.type}.${name}: item`);
      assert.ok(live.includes(`data-item-remove="${name}.0" aria-label="Remover ${field.noun} 1"`), `${block.type}.${name}: ×`);
      assert.ok(live.includes(`data-item-add="${name}">+ Adicionar ${field.noun}</button>`), `${block.type}.${name}: +`);
    }
  }
});

test("listas: a página pública não leva os botões de adicionar e remover", () => {
  const page = render(listBlocks(), false);
  assert.ok(!/data-item|item-add|item-remove/.test(page));
});

test("listas: cheia, sem '+ Adicionar'; galeria com × em cada imagem", () => {
  const full = Array.from({ length: BLOCKS.guarantee.fields.items.max }, () => ({ icon: "check", text: "Selo" }));
  const live = render([{ type: "guarantee", title: "G", items: full }], "live");
  assert.ok(!live.includes("data-item-add"));
  assert.ok(live.includes(`data-item-remove="items.${full.length - 1}"`));
  const data = product([{ type: "gallery", title: "G", images: [{ image: M1 }] }]);
  data.media = new Map([[M1, { url: "/uploads/a.webp", alt_text: "", width: 1500, height: 1000 }]]);
  const gallery = renderSalesPage(data, { baseUrl: "http://localhost", preview: "live" });
  assert.match(gallery, /<li class="slide" aria-label="Slide 1 de 2" data-item="images\.0"><img[^>]*><button type="button" class="item-remove" data-item-remove="images\.0"/);
});

test("listas vazias: no editor o bloco continua, oculto, com o botão de adicionar", () => {
  for (const type of ["benefits", "topics", "checklist", "audience", "faq"]) {
    const live = render([{ type, title: "T", items: [] }], "live");
    assert.match(live, /data-block="0" data-hidden/, type);
    assert.ok(live.includes('data-item-add="items"'), type);
    assert.ok(!render([{ type, title: "T", items: [] }], false).includes("v-section"), type);
  }
  assert.ok(render([{ type: "hero", badges: [] }], "live").includes('data-item-add="badges">+ Adicionar selo'));
  assert.ok(!render([{ type: "hero", badges: [] }], false).includes('class="badges"'));
});

/* ---------- Links (autor e redes sociais) ---------- */
const { validateSections } = require("../sales/blocks");
const link = (url) => validateSections([{ type: "social", items: [{ network: "site", url }] }]);

test("endereço de link: completa https:// e mailto:, recusa esquemas perigosos", () => {
  assert.equal(link("linkedin.com/in/fulano").sections[0].items[0].url, "https://linkedin.com/in/fulano");
  assert.equal(link("  https://site.com.br/a?b=1 ").sections[0].items[0].url, "https://site.com.br/a?b=1");
  assert.equal(link("fulano@email.com").sections[0].items[0].url, "mailto:fulano@email.com");
  assert.equal(link("").sections[0].items[0].url, "");
  for (const bad of ["javascript:alert(1)", "JavaScript:alert(1)", "data:text/html,x", "ftp://x.com", "https://"]) {
    assert.match(link(bad).error || "", /endereço inválido/, bad);
  }
});

test("autor: links com ícone pelo endereço; a página pública mostra só os que têm endereço", () => {
  const sections = [{ type: "author", name: "Ana", links: [
    { label: "", url: "lattes.cnpq.br/123" }, { label: "Meu LinkedIn", url: "https://www.linkedin.com/in/ana" },
    { label: "Sem endereço", url: "" }] }];
  const page = render(sections, false);
  assert.match(page, /<ul class="link-list author-links"><li><a class="link-btn" href="https:\/\/lattes\.cnpq\.br\/123" target="_blank" rel="noopener noreferrer"><svg class="link-ico" aria-hidden="true"><use href="#i-cap"\/><\/svg>Currículo Lattes<span class="sr-only"> \(abre em nova aba\)<\/span><\/a><\/li>/);
  assert.match(page, /#i-net-linkedin"\/><\/svg>Meu LinkedIn</);
  assert.ok(!page.includes("Sem endereço"));
  assert.ok(page.includes('<symbol id="i-net-linkedin"'));
  const live = render(sections, "live");
  assert.match(live, /<a class="link-btn" data-no-url title="Defina o endereço em Configurar bloco ⚙">.*<span data-field="links\.2\.label">Sem endereço<\/span>/);
  assert.match(live, /<span data-field="links\.0\.label" data-fallback>Currículo Lattes<\/span>/);
  assert.ok(!render([{ type: "author", name: "Ana" }], false).includes("author-links"));
});

test("redes sociais: botões com o ícone da rede; sem links, some da página e fica oculto no editor", () => {
  const sections = [{ type: "social", title: "Siga", items: [
    { network: "instagram", url: "instagram.com/perfil", label: "" }, { network: "email", url: "a@b.com", label: "Escreva" },
    { network: "youtube", url: "", label: "" }] }];
  const page = render(sections, false);
  assert.match(page, /<a class="link-btn" href="https:\/\/instagram\.com\/perfil" target="_blank" rel="noopener noreferrer"><svg class="link-ico" aria-hidden="true"><use href="#i-net-instagram"\/><\/svg>Instagram</);
  assert.match(page, /<a class="link-btn" href="mailto:a@b\.com"><svg class="link-ico" aria-hidden="true"><use href="#i-net-email"\/><\/svg>Escreva<\/a>/);
  assert.ok(!page.includes("#i-net-youtube\"/></svg>YouTube"));
  const empty = [{ type: "social", items: [{ network: "x", url: "" }] }];
  assert.ok(!render(empty, false).includes("social-links"));
  assert.match(render(empty, "live"), /data-block="0" data-hidden/);
  assert.match(render(empty, "live"), /<h2 id="t-1" data-field="title" data-fallback>Acompanhe nas redes<\/h2>/);
});

/* ---------- Oferta final ---------- */
test("oferta: texto à esquerda, cartão de compra com preço, garantia, cadeado e aviso da Kiwify", () => {
  const page = render([{ type: "offer", title: "Garanta", text: "Desc.", items: [{ icon: "bolt", text: "Rápido" }],
    proof_title: "Especialista", proof_text: "10 anos", price_label: "Por", conditions: [{ text: "Pagamento único" }],
    guarantee_title: "Garantia de 7 dias", guarantee_text: "Devolvemos.", cta_label: "Quero me matricular agora" }], false);
  assert.match(page, /<div class="container offer-grid">\s*<div class="offer-main">/);
  assert.match(page, /<p class="lead">Desc\.<\/p>/);
  assert.match(page, /<ul class="offer-benefits"><li><svg class="ico" aria-hidden="true"><use href="#i-bolt"\/><\/svg>Rápido<\/li><\/ul>/);
  assert.match(page, /<div class="offer-proof">.*<strong>Especialista<\/strong><span>10 anos<\/span>/);
  assert.match(page, /<div class="buy-card">[\s\S]*R\$\s49,90[\s\S]*Pagamento único[\s\S]*<div class="buy-guarantee"><svg class="ico" aria-hidden="true"><use href="#i-shield"\/><\/svg><p><strong>Garantia de 7 dias<\/strong>/);
  assert.match(page, /<a class="btn-cta" href="https:\/\/pay\.example\.com\/x" target="_blank" rel="noopener noreferrer"><svg class="cta-ico" aria-hidden="true"><use href="#i-lock"\/><\/svg>Quero me matricular agora/);
  assert.match(page, /<p class="buy-note">Pagamento processado com segurança pela Kiwify\.<\/p>/);
});

test("oferta antiga (só os campos de antes) continua válida: preço, botão, e sem cartões vazios", () => {
  const old = [{ type: "offer", image: null, eyebrow: "Oferta", title: "Garanta", price_label: "Oferta especial", cta_label: "Garantir agora" }];
  assert.ok(validateSections(old).sections);
  const page = render(old, false);
  assert.match(page, /Oferta especial<\/span> R\$\s49,90/);
  assert.match(page, />Garantir agora<span class="sr-only">/);
  for (const piece of ["offer-benefits", "offer-proof", "buy-conditions", "buy-guarantee"]) assert.ok(!page.includes(piece), piece);
  const live = render(old, "live");
  assert.match(live, /<div class="offer-proof" data-empty>/);
  assert.match(live, /<div class="buy-guarantee" data-empty>/);
  assert.match(live, /<p class="buy-note" data-field="note" data-fallback>/);
});

test("marca do professor: nome e logo vão para o menu e o rodapé, como texto (sem HTML)", () => {
  const logoId = "11111111-1111-4111-8111-111111111111";
  const data = {
    ...product(defaultSections()), brand_name: "Coutinho <b>Treinamentos</b>", brand_logo_id: logoId,
    media: new Map([[logoId, { id: logoId, url: "/uploads/logo.webp", width: 300, height: 90, alt_text: "Logo" }]]),
  };
  const page = renderSalesPage(data, { baseUrl: "http://localhost", preview: false });
  assert.match(page, /<div id="site-header" data-brand-name="Coutinho &lt;b&gt;Treinamentos&lt;\/b&gt;" data-brand-logo="\/uploads\/logo.webp"/);
  assert.match(page, /<strong>Coutinho &lt;b&gt;Treinamentos&lt;\/b&gt;<\/strong> ©/);
  assert.doesNotMatch(page, /data-site="slogan"/);
  // Sem marca: menu e rodapé do site.
  const plain = render(defaultSections(), false);
  assert.match(plain, /<div id="site-header"><\/div>/);
  assert.match(plain, /<strong data-site="nome"><\/strong>/);
});

test("ícone da aba: o da empresa, senão o logo dela, senão o do site", () => {
  const logoId = "11111111-1111-4111-8111-111111111111", iconId = "22222222-2222-4222-8222-222222222222";
  const media = new Map([
    [logoId, { id: logoId, url: "/uploads/logo.webp", width: 300, height: 90, alt_text: "" }],
    [iconId, { id: iconId, url: "/uploads/icone.webp", width: 64, height: 64, alt_text: "" }],
  ]);
  const page = (extra) => renderSalesPage({ ...product(defaultSections()), media, ...extra },
    { baseUrl: "http://localhost", preview: false });
  assert.match(page({ brand_logo_id: logoId, brand_icon_id: iconId }), /<link rel="icon" type="image\/webp" href="\/uploads\/icone.webp">/);
  assert.match(page({ brand_logo_id: logoId }), /<link rel="icon" type="image\/webp" href="\/uploads\/logo.webp">/);
  assert.match(page({}), /<link rel="icon" type="image\/png" href="\/assets\/favicon\/favicon.png">/);
});

test("página de vendas sem botão voltar (navegação enxuta)", () => {
  for (const mode of [false, true, "live"]) assert.doesNotMatch(render(defaultSections(), mode), /v-back|data-back/);
});

test("grades: colunas escolhidas viram classe; automático não leva classe", () => {
  const item = { icon: "check", title: "T", text: "x" };
  assert.match(render([{ type: "topics", title: "T", items: [item], columns: "four" }], false), /<ul class="grid8 cols-4">/);
  assert.match(render([{ type: "audience", title: "T", items: [{ icon: "user", text: "A" }], columns: "three" }], false), /<ul class="who cols-3">/);
  assert.match(render([{ type: "topics", title: "T", items: [item] }], false), /<ul class="grid8">/);
});

test("texto formatado: negrito, cor e alinhamento na página pública e no editor", () => {
  const sections = [{ type: "faq", title: "[align=center]Dúvidas [b]frequentes[/b]", items: [
    { question: "[c=accent]Pergunta[/c]", answer: "[align=right][i]um[/i]\n\ndois" }] }];
  const page = render(sections, false);
  assert.match(page, /<h2 id="t-\d+" data-align="center">Dúvidas <strong>frequentes<\/strong><\/h2>/);
  // Texto formatado dentro de elemento flex (pergunta do FAQ) ganha um <span> em volta.
  assert.match(page, /<summary><span><span class="tx-c-accent">Pergunta<\/span><\/span><\/summary>/);
  assert.match(page, /<p data-align="right"><em>um<\/em><\/p><p data-align="right">dois<\/p>/);
  assert.doesNotMatch(page, /\[b\]|\[align/);
  const live = render(sections, "live");
  assert.match(live, /data-field="title" data-align="center">Dúvidas <strong>frequentes<\/strong>/);
});

/* ---------- Blocos salvos (já resolvidos por pages.js: conteúdo do bloco salvo + campos locais) ---------- */
test("bloco vindo de bloco salvo: público igual a um bloco comum; no editor, trancado e com etiqueta", () => {
  const sections = [
    { type: "faq", title: "Dúvidas", items: [{ question: "P?", answer: "R" }] },
    { type: "social", title: "Siga o professor", background: "dark",
      items: [{ network: "instagram", url: "https://instagram.com/prof", label: "" }] },
  ];
  const data = { ...product(sections), shared: new Map([[1, { id: "x", name: "Redes — <Prof>" }]]) };
  const pub = renderSalesPage(data, { baseUrl: "http://localhost", preview: false });
  assert.ok(pub.includes('href="https://instagram.com/prof"'));
  assert.ok(!pub.includes("data-shared"));

  const live = renderSalesPage(data, { baseUrl: "http://localhost", preview: "live" });
  const [faq, social] = sectionsOf(live).map(([, html]) => html);
  assert.ok(faq.includes("data-field"), "os outros blocos continuam editáveis");
  assert.ok(social.includes('data-shared="Redes — &lt;Prof&gt;"'), "etiqueta com o nome escapado");
  for (const marker of ["data-field", "data-item", "item-add", "item-remove", "data-icon-field"]) {
    assert.ok(!social.includes(marker), `"${marker}" apareceu no bloco salvo`);
  }
  assert.ok(social.includes("is-dark"), "o fundo escolhido na página vale");
});

test("bloco salvo sem nenhuma rede com link: no editor vira aviso com o nome do bloco", () => {
  const data = { ...product([{ type: "social", items: [] }]), shared: new Map([[0, { id: "x", name: "Prof. Vazio" }]]) };
  const live = renderSalesPage(data, { baseUrl: "http://localhost", preview: "live" });
  assert.ok(live.includes("editor-hidden-block"));
  assert.ok(live.includes("Prof. Vazio"));
});

test("imagens com versões menores levam srcset e sizes; sem versões, só src", () => {
  const big = "11111111-1111-4111-8111-111111111111", small = "22222222-2222-4222-8222-222222222222";
  const data = product([{ type: "hero", title: "T", image: big }, { type: "offer", title: "Oferta", image: small }]);
  data.media = new Map([
    [big, { id: big, url: "/uploads/a.webp", width: 1024, height: 1536, alt_text: "",
      srcset: "/uploads/a-480.webp 480w, /uploads/a-960.webp 960w, /uploads/a.webp 1024w" }],
    [small, { id: small, url: "/uploads/b.webp", width: 200, height: 200, alt_text: "", srcset: null }],
  ]);
  const page = renderSalesPage(data, { baseUrl: "http://localhost" });
  assert.match(page, /<img class="v-media" src="\/uploads\/a\.webp" srcset="\/uploads\/a-480\.webp 480w, \/uploads\/a-960\.webp 960w, \/uploads\/a\.webp 1024w" sizes="[^"]+480px[^"]*"/);
  assert.match(page, /<img class="buy-media" src="\/uploads\/b\.webp" alt=""/);
});
