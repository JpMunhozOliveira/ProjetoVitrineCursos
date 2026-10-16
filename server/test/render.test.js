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
    for (const marker of ["data-field", "data-empty", "data-hidden", "data-fallback", "data-multiline", "venda-editor.css", "editor-hidden-block"]) {
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
  // não tem imagens (não aparece; o editor mostra o aviso e o título fica no painel).
  assert.deepEqual(missing.filter((m) => !["benefits:title", "gallery:title"].includes(m)), []);
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
