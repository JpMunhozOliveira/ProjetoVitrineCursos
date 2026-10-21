// Testes do esquema de blocos (validação do que chega na API). Rodar: npm test (node --test)
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { BLOCKS, ICONS, ICON_GROUPS, MAX_BLOCKS, validateSections, validBlocks, mediaIds, defaultSections } = require("../sales/blocks");
const { createLimiter } = require("../lib/security");

test("aceita o modelo padrão inteiro", () => {
  const { sections, error } = validateSections(defaultSections());
  assert.equal(error, undefined);
  assert.equal(sections.length, defaultSections().length);
});

test("preenche campos ausentes com valores padrão", () => {
  const { sections } = validateSections([{ type: "faq" }]);
  assert.deepEqual(sections[0], { type: "faq", eyebrow: "", title: "", intro: "", items: [], background: "auto" });
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

test("ícones: todos têm nome e um desenho SVG válido (só comandos de caminho e números)", () => {
  assert.ok(Object.keys(ICONS).length >= 140);
  for (const [name, icon] of Object.entries(ICONS)) {
    assert.match(name, /^[a-z]+$/, name);
    assert.ok(icon.label, name);
    assert.match(icon.d, /^M[MLHVCSQTAZmlhvcsqtaz0-9.,\s-]+$/, name);
  }
});

test("validBlocks descarta só o bloco inválido e mantém as imagens dos outros", () => {
  const photo = "11111111-1111-4111-8111-111111111111", cover = "22222222-2222-4222-8222-222222222222";
  const stored = [
    { type: "author", name: "Ana", photo },
    { type: "faq", campo_antigo: "removido do esquema" }, // inválido: invalidaria a lista inteira
    null,
    { type: "hero", image: cover },
  ];
  assert.ok(validateSections(stored).error);
  const valid = validBlocks(stored);
  assert.deepEqual(valid.map((x) => x.index), [0, 3]); // posição ORIGINAL de cada bloco
  assert.deepEqual(mediaIds(valid.map((x) => x.block)).sort(), [photo, cover].sort());
  assert.deepEqual(validBlocks(undefined), []);
});

test("limitador de tentativas não passa do número máximo de chaves", () => {
  const limiter = createLimiter({ max: 2, windowMs: 60_000, maxKeys: 3 });
  for (const key of ["a", "b", "c", "d", "e"]) limiter.hit(key);
  limiter.hit("e"); limiter.hit("e");
  assert.equal(limiter.isBlocked("e"), true);
  assert.equal(limiter.isBlocked("a"), false); // a mais antiga foi descartada para caber a nova
});

test("ícones: cada um está em exatamente um grupo do seletor", () => {
  const grouped = ICON_GROUPS.flatMap(([, keys]) => keys);
  assert.deepEqual([...grouped].sort(), Object.keys(ICONS).sort());
  assert.equal(new Set(grouped).size, grouped.length, "ícone repetido em mais de um grupo");
});

test("grades: colunas aceitam automático, 2, 3 ou 4 (two/three/four)", () => {
  for (const type of ["topics", "audience"]) {
    assert.equal(validateSections([{ type }]).sections[0].columns, "auto");
    assert.equal(validateSections([{ type, columns: "four" }]).sections[0].columns, "four");
    assert.match(validateSections([{ type, columns: "five" }]).error, /opção inválida/);
  }
});

/* ---------- Blocos salvos ---------- */
const { validateSharedData, sharedIds } = require("../sales/blocks");
const SHARED_ID = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";

test("aceita referência a bloco salvo só com os campos locais", () => {
  const { sections, error } = validateSections([{ type: "social", shared: SHARED_ID.toUpperCase(), background: "dark" }]);
  assert.equal(error, undefined);
  assert.deepEqual(sections[0], { type: "social", shared: SHARED_ID, background: "dark" });
  assert.deepEqual(validateSections([{ type: "social", shared: SHARED_ID }]).sections[0].background, "auto");
});

test("recusa referência com conteúdo junto, ID inválido ou tipo não compartilhável", () => {
  assert.match(validateSections([{ type: "social", shared: SHARED_ID, items: [] }]).error, /não suportado/);
  assert.match(validateSections([{ type: "social", shared: "abc" }]).error, /bloco salvo inválido/);
  assert.match(validateSections([{ type: "social", shared: null }]).error, /bloco salvo inválido/);
  assert.match(validateSections([{ type: "faq", shared: SHARED_ID }]).error, /não pode ser um bloco salvo/);
});

test("conteúdo do bloco salvo: valida os campos e não aceita os locais", () => {
  const ok = validateSharedData("social", { title: "Siga", items: [{ network: "instagram", url: "instagram.com/prof" }] });
  assert.equal(ok.error, undefined);
  assert.equal(ok.data.items[0].url, "https://instagram.com/prof");
  assert.ok(!("background" in ok.data));
  assert.match(validateSharedData("social", { background: "dark" }).error, /não suportado/);
  assert.match(validateSharedData("social", { items: [{ network: "x", url: "javascript:alert(1)" }] }).error, /endereço inválido/);
  assert.match(validateSharedData("faq", {}).error, /Tipo de bloco inválido/);
  assert.match(validateSharedData("social", "texto").error, /formato inválido/);
});

test("lista os blocos salvos usados, sem repetir", () => {
  const { sections } = validateSections([
    { type: "social", shared: SHARED_ID }, { type: "faq" }, { type: "social", shared: SHARED_ID },
  ]);
  assert.deepEqual(sharedIds(sections), [SHARED_ID]);
  assert.deepEqual(mediaIds(sections), []);
});
