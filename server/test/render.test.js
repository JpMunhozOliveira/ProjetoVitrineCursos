// Testes da renderização da página de vendas: a página pública não leva nada do editor, e a
// pré-visualização ao vivo marca os textos editáveis corretamente. Rodar: npm test (node --test)
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { renderSalesPage } = require("../sales/render");
const { BLOCKS, defaultSections } = require("../sales/blocks");

const product = (sections) => ({
  title: "Produto de Teste", slug: "produto-teste", short_description: "", status: "published",
  price_cents: 4990, checkout_url: "https://pay.example.com/x", image_id: null,
  sections, seo_title: "", seo_description: "", theme: null, published_at: null, media: new Map(),
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
  assert.ok(render(sample(), "live").includes('href="/css/venda-editor.css"'));
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
  assert.match(render(sections, "live"), /<details class="faq" open>/);
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
  assert.match(render([{ type: "testimonials", items: [] }], "live"), /Depoimentos<\/strong> — não aparece na página: escreva pelo menos um depoimento/);
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
