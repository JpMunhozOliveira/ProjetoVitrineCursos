// Texto formatado no editor: conteúdo editável (DOM) -> marcações, e o caminho do painel.
import { test } from "node:test";
import assert from "node:assert/strict";
import { serialize, plain, hasInline, fromPlain, SENTINELS } from "../src/state/richtext.js";

// Nós falsos: só o que serialize usa (nodeType, nodeName, childNodes, data, getAttribute).
const t = (data) => ({ nodeType: 3, data });
const el = (name, attrs, ...children) => ({
  nodeType: 1, nodeName: name, childNodes: children.map((c) => (typeof c === "string" ? t(c) : c)),
  getAttribute: (k) => (attrs && Object.hasOwn(attrs, k) ? attrs[k] : null),
});
const field = (attrs, ...children) => el("SPAN", attrs, ...children);

test("texto puro continua igual (com [ escapado)", () => {
  assert.equal(serialize(field(null, "Olá [mundo]"), false), "Olá [[mundo]");
  assert.equal(serialize(field(null, "   "), false), "");
});

test("negrito, itálico e cor viram marcações, inclusive aninhados", () => {
  assert.equal(serialize(field(null, "a ", el("B", null, "b"), " ", el("I", null, "c")), false), "a [b]b[/b] [i]c[/i]");
  assert.equal(serialize(field(null, el("STRONG", null, "x ", el("SPAN", { class: "tx-c-accent" }, "y"))), false), "[b]x [c=accent]y[/c][/b]");
  // Cor aplicada pela barra (execCommand foreColor com a cor-sentinela), antes da troca por <span>.
  assert.equal(serialize(field(null, el("FONT", { color: SENTINELS.red }, "z")), false), "[c=red]z[/c]");
  // Cor desconhecida ou estilo qualquer: só o texto.
  assert.equal(serialize(field(null, el("FONT", { color: "#ff0000" }, "w"), el("SPAN", { style: "x" }, "v")), false), "wv");
});

test("alinhamento vem do atributo data-align do campo", () => {
  assert.equal(serialize(field({ "data-align": "center" }, "Oi"), false), "[align=center]Oi");
  assert.equal(serialize(field({ "data-align": "bogus" }, "Oi"), false), "Oi");
});

test("várias linhas: <p> separa parágrafos, <div>/<br> quebram linha; formatação fecha em cada linha", () => {
  const multi = el("DIV", null, el("P", null, el("B", null, "um")), el("P", null, "dois"));
  assert.equal(serialize(multi, true), "[b]um[/b]\n\ndois");
  const typed = el("DIV", null, "linha 1", el("DIV", null, el("I", null, "linha 2")), el("DIV", null, el("BR", null)));
  assert.equal(serialize(typed, true), "linha 1\n[i]linha 2[/i]");
  assert.equal(serialize(el("DIV", null, el("B", null, "a", el("BR", null), "b")), true), "[b]a[/b]\n[b]b[/b]");
  // Uma linha só: quebras viram espaço.
  assert.equal(serialize(field(null, "a", el("BR", null), "b"), false), "a b");
});

test("painel: mostra o texto sem marcações e, ao editar, mantém só o alinhamento", () => {
  assert.equal(plain("[align=center][b]Oi[/b] [[x]"), "Oi [x]");
  assert.equal(hasInline("[align=center]Oi"), false);
  assert.equal(hasInline("[i]Oi[/i]"), true);
  assert.equal(fromPlain("[align=right][b]velho[/b]", "novo [x]"), "[align=right]novo [[x]");
  assert.equal(fromPlain("[align=right]x", ""), "");
});
