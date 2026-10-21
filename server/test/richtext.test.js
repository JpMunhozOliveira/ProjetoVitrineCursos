// Testes do texto formatado (negrito, itálico, cor, alinhamento). Rodar: npm test (node --test)
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { toHtml, paragraphsHtml, plain, alignOf, canonical } = require("../sales/richtext");
const { validateSections } = require("../sales/blocks");

const h = (v) => String(toHtml(v));

test("marcações viram tags; texto sem marcação fica igual", () => {
  assert.equal(h("Só texto"), "Só texto");
  assert.equal(h("[b]a[/b] [i]b[/i] [c=accent]c[/c]"), '<strong>a</strong> <em>b</em> <span class="tx-c-accent">c</span>');
  assert.equal(h("[b]x [c=red]y[/c][/b]"), '<strong>x <span class="tx-c-red">y</span></strong>');
});

test("nunca deixa passar HTML nem atributos (XSS)", () => {
  assert.equal(h("<script>alert(1)</script>"), "&lt;script&gt;alert(1)&lt;/script&gt;");
  assert.equal(h('[c=x" onclick=alert(1)]oi[/c]'), "[c=x&quot; onclick=alert(1)]oi[/c]");
  assert.equal(h("[c=javascript]oi[/c]"), "[c=javascript]oi[/c]");
  assert.equal(h("[b]<img src=x onerror=alert(1)>[/b]"), "<strong>&lt;img src=x onerror=alert(1)&gt;</strong>");
});

test("marcações mal formadas: fechamento solto vira texto, abertura sem fim fecha no final", () => {
  assert.equal(h("[/b]solto [b]aberto"), "[/b]solto <strong>aberto</strong>");
  assert.equal(h("[b][i]x[/b]y[/i]"), "<strong><em>x</em></strong><em>y</em>");
  assert.equal(h("[b][/b]vazio"), "vazio");
});

test("[[ é colchete literal; plain conta só o texto visível", () => {
  assert.equal(h("[[b]] não é negrito"), "[b]] não é negrito");
  assert.equal(plain("[align=center][b]abc[/b] [c=muted]d[/c]"), "abc d");
  assert.equal(plain("[[x"), "[x");
});

test("alinhamento é um prefixo opcional", () => {
  assert.equal(alignOf("[align=center]Oi"), "center");
  assert.equal(alignOf("[align=left]Oi"), "left");
  assert.equal(alignOf("Oi"), null); // sem prefixo: o padrão do bloco
  assert.equal(alignOf("Oi [align=right]"), null);
  assert.equal(h("[align=justify]Oi"), "Oi");
});

test("canonical: limpa marcações inválidas e vazias, mantém as válidas", () => {
  assert.equal(canonical("[b]a[/b]"), "[b]a[/b]");
  assert.equal(canonical("[/b]x"), "[[/b]x");
  assert.equal(canonical("[b] [/b]"), "");
  assert.equal(canonical("[align=center]"), "");
  assert.equal(canonical("[align=right][b]x"), "[align=right][b]x[/b]");
});

test("parágrafos mantêm a formatação que atravessa a linha em branco", () => {
  assert.deepEqual(paragraphsHtml("[b]um\n\ndois[/b] três").map(String), ["<strong>um</strong>", "<strong>dois</strong> três"]);
});

test("validação: limite conta o texto visível e grava a forma limpa", () => {
  const title = "[b]" + "x".repeat(120) + "[/b]"; // título do bloco aceita 120 letras
  assert.equal(validateSections([{ type: "faq", title }]).sections[0].title, title);
  assert.match(validateSections([{ type: "faq", title: "[b]" + "x".repeat(121) + "[/b]" }]).error, /máximo de 120/);
  assert.match(validateSections([{ type: "faq", title: "[b][/b]".repeat(100) + "x" }]).error, /formatação demais/);
  assert.equal(validateSections([{ type: "faq", title: "[/i]oi" }]).sections[0].title, "[[/i]oi");
});
