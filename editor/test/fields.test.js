// Campos editáveis na página: caminho data-field -> campo do esquema, e texto lido -> valor.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveField, normalizeText } from "../src/state/fields.js";

const schema = {
  blocks: {
    faq: { fields: {
      title: { type: "text", label: "Título", max: 120 },
      items: { type: "list", max: 20, item: { question: { type: "text", label: "Pergunta", max: 200 }, answer: { type: "textarea", label: "Resposta", max: 1500 } } },
    } },
    hero: { fields: { image: { type: "image", label: "Imagem" } } },
  },
};
const sections = [{ type: "hero" }, { type: "faq", title: "", items: [{ question: "", answer: "" }] }];

test("resolve o caminho do servidor no caminho completo do estado", () => {
  const { field, path } = resolveField(schema, sections, 1, "items.0.answer");
  assert.equal(field.label, "Resposta");
  assert.deepEqual(path, ["sections", 1, "items", 0, "answer"]);
  assert.deepEqual(resolveField(schema, sections, 1, "title").path, ["sections", 1, "title"]);
});

test("recusa caminhos que não são texto ou não existem", () => {
  assert.equal(resolveField(schema, sections, 0, "image"), null);        // imagem: só pelo painel
  assert.equal(resolveField(schema, sections, 1, "items"), null);        // lista
  assert.equal(resolveField(schema, sections, 1, "nada"), null);
  assert.equal(resolveField(schema, sections, 1, "constructor"), null);  // nome herdado de Object
  assert.equal(resolveField(schema, sections, 9, "title"), null);        // bloco inexistente
});

test("uma linha: quebras viram espaço; espaço não separável vira espaço comum", () => {
  assert.equal(normalizeText("Olá\nmundo", false), "Olá mundo");
  assert.equal(normalizeText("a b", false), "a b");
});

test("várias linhas: no máximo uma linha em branco entre parágrafos", () => {
  assert.equal(normalizeText("P1\n\n\n\nP2\n", true), "P1\n\nP2");
  assert.equal(normalizeText("linha 1\r\nlinha 2", true), "linha 1\nlinha 2");
});

test("campo apagado vira vazio (sem o <br> que o navegador deixa)", () => {
  assert.equal(normalizeText("\n", false), "");
  assert.equal(normalizeText("\n", true), "");
  assert.equal(normalizeText("   ", true), "");
});
