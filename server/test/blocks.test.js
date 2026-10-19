// Testes do esquema de blocos (validação do que chega na API). Rodar: npm test (node --test)
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { BLOCKS, MAX_BLOCKS, validateSections, defaultSections } = require("../sales/blocks");

test("aceita o modelo padrão inteiro", () => {
  const { sections, error } = validateSections(defaultSections());
  assert.equal(error, undefined);
  assert.equal(sections.length, defaultSections().length);
});

test("preenche campos ausentes com valores padrão", () => {
  const { sections } = validateSections([{ type: "faq" }]);
  assert.deepEqual(sections[0], { type: "faq", eyebrow: "", title: "", items: [], background: "auto" });
});

test("recusa tipo desconhecido, inclusive nomes herdados de Object", () => {
  for (const type of ["video", "constructor", "toString", "__proto__", 1, null]) {
    assert.match(validateSections([{ type }]).error, /tipo inválido/);
  }
});

test("recusa campo que o tipo não tem", () => {
  assert.match(validateSections([{ type: "hero", html: "<b>x</b>" }]).error, /não suportado/);
});

test("aplica o tamanho máximo dos textos e das listas", () => {
  const max = BLOCKS.faq.fields.title.max;
  assert.match(validateSections([{ type: "faq", title: "x".repeat(max + 1) }]).error, /máximo de \d+ caracteres/);
  const items = Array.from({ length: BLOCKS.faq.fields.items.max + 1 }, () => ({ question: "q", answer: "a" }));
  assert.match(validateSections([{ type: "faq", items }]).error, /máximo de \d+ itens/);
  assert.match(validateSections(Array.from({ length: MAX_BLOCKS + 1 }, () => ({ type: "hero" }))).error, /no máximo/);
});

test("mensagem de erro aponta o bloco e o item", () => {
  const error = validateSections([{ type: "hero" }, { type: "faq", items: [{ question: 1 }] }]).error;
  assert.match(error, /^Bloco 2 \(Perguntas frequentes\) › Perguntas › item 1 › Pergunta/);
});

test("guarda texto como texto (sem interpretar HTML) e corta espaços", () => {
  const { sections } = validateSections([{ type: "hero", title: "  <script>alert(1)</script> Ação  " }]);
  assert.equal(sections[0].title, "<script>alert(1)</script> Ação");
});

test("recusa ícone e imagem inválidos", () => {
  assert.match(validateSections([{ type: "topics", items: [{ icon: "constructor" }] }]).error, /ícone inválido/);
  assert.match(validateSections([{ type: "author", photo: "../etc/passwd" }]).error, /imagem inválida/);
});

test("depoimentos: aceita texto, nome, cargo e foto; aplica os limites", () => {
  const ok = validateSections([{ type: "testimonials", title: "O que dizem", items: [{ quote: "Ótimo!", name: "Ana", role: "Contadora" }] }]);
  assert.equal(ok.error, undefined);
  assert.deepEqual(ok.sections[0].items[0], { quote: "Ótimo!", name: "Ana", role: "Contadora", photo: null });
  assert.match(validateSections([{ type: "testimonials", items: [{ quote: "x".repeat(601) }] }]).error, /Depoimento: máximo de 600/);
  assert.match(validateSections([{ type: "testimonials", items: Array(10).fill({ quote: "x" }) }]).error, /máximo de 9 itens/);
});

test("modelo padrão não traz depoimentos (exemplo poderia ir ao ar como se fosse real)", () => {
  assert.ok(!defaultSections().some((b) => b.type === "testimonials"));
});

test("fundo da seção: aceita só as opções, e vazio vira automático", () => {
  for (const background of ["auto", "light", "soft", "dark"]) {
    assert.equal(validateSections([{ type: "faq", background }]).sections[0].background, background);
  }
  assert.equal(validateSections([{ type: "faq", background: "" }]).sections[0].background, "auto");
  for (const background of ["roxo", "constructor", "toString", 1, true]) {
    assert.match(validateSections([{ type: "faq", background }]).error, /Fundo da seção: opção inválida/);
  }
});

test("blocos salvos antes do visual novo (sem rótulo nem fundo) continuam válidos", () => {
  const { sections, error } = validateSections([{ type: "author", name: "Ana", role: "", bio: "", photo: null }]);
  assert.equal(error, undefined);
  assert.equal(sections[0].eyebrow, "");
  assert.equal(sections[0].background, "auto");
});

test("abertura, oferta e chamada são sempre escuras (sem escolha de fundo)", () => {
  for (const type of ["hero", "offer", "cta"]) assert.ok(!BLOCKS[type].fields.background, type);
  assert.match(validateSections([{ type: "cta", background: "dark" }]).error, /não suportado/);
});

test("chamada intermediária: texto e botão com limites", () => {
  const ok = validateSections([{ type: "cta", title: "Pronto?", cta_label: "Quero" }]);
  assert.deepEqual(ok.sections[0], { type: "cta", eyebrow: "", title: "Pronto?", cta_label: "Quero" });
  assert.match(validateSections([{ type: "cta", eyebrow: "x".repeat(41) }]).error, /Rótulo acima do título: máximo de 40/);
});
