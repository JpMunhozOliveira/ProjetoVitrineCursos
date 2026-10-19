// Testes do estado do editor (sem navegador): operações sobre blocos e histórico.
// Rodar: npm test (node --test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { withKeys, stripKeys, duplicateBlock, reducer, newBlock, hasText } from "../src/state/document.js";
import { historyReducer, initialHistory } from "../src/state/history.js";

// Esquema mínimo, no mesmo formato que /api/admin/sales-blocks devolve.
const schema = {
  maxBlocks: 30,
  blocks: {
    hero: { fields: { title: { type: "text", max: 200 } } },
    faq: { fields: {
      title: { type: "text", max: 120 },
      items: { type: "list", max: 20, item: { question: { type: "text", max: 200 }, answer: { type: "textarea", max: 1500 } } },
    } },
  },
};

const page = () => ({
  sections: withKeys([
    { type: "hero", title: "A" },
    { type: "faq", title: "B", items: [{ question: "Q1", answer: "R1" }, { question: "Q2", answer: "R2" }] },
    { type: "hero", title: "C" },
  ], schema),
});
const titles = (doc) => doc.sections.map((b) => b.title);

test("insert coloca o bloco na posição pedida (início, meio, fim)", () => {
  const doc = page();
  const block = withKeys([{ type: "hero", title: "X" }], schema)[0];
  assert.deepEqual(titles(reducer(doc, { type: "insert", path: ["sections"], index: 0, value: block })), ["X", "A", "B", "C"]);
  assert.deepEqual(titles(reducer(doc, { type: "insert", path: ["sections"], index: 2, value: block })), ["A", "B", "X", "C"]);
  assert.deepEqual(titles(reducer(doc, { type: "insert", path: ["sections"], value: block })), ["A", "B", "C", "X"]);
});

test("move troca a ordem sem alterar o documento original", () => {
  const doc = page();
  const next = reducer(doc, { type: "move", path: ["sections"], from: 0, to: 1 });
  assert.deepEqual(titles(next), ["B", "A", "C"]);
  assert.deepEqual(titles(doc), ["A", "B", "C"]);
});

test("remove tira só o bloco indicado", () => {
  assert.deepEqual(titles(reducer(page(), { type: "remove", path: ["sections"], index: 1 })), ["A", "C"]);
});

test("duplicateBlock gera chaves novas em todos os níveis", () => {
  const original = page().sections[1];
  const copy = duplicateBlock(original, schema);
  assert.deepEqual(stripKeys(copy), stripKeys(original));
  assert.notEqual(copy._key, original._key);
  copy.items.forEach((item, i) => assert.notEqual(item._key, original.items[i]._key));
});

test("editar a cópia não altera o original", () => {
  const doc = page();
  const copy = duplicateBlock(doc.sections[1], schema);
  let next = reducer(doc, { type: "insert", path: ["sections"], index: 2, value: copy });
  next = reducer(next, { type: "set", path: ["sections", 2, "items", 0, "question"], value: "Mudou" });
  assert.equal(next.sections[1].items[0].question, "Q1");
  assert.equal(next.sections[2].items[0].question, "Mudou");
  copy.items[1].answer = "mutação direta"; // nem uma mutação acidental atinge o original
  assert.equal(doc.sections[1].items[1].answer, "R2");
});

test("saved: resposta do servidor substitui o documento quando nada mudou", () => {
  const sent = page();
  let state = historyReducer(initialHistory, { type: "start", doc: sent });
  const fromServer = { ...sent, sections: sent.sections.map((b) => ({ ...b })) };
  state = historyReducer(state, { type: "saved", sent, doc: fromServer });
  assert.equal(state.doc, fromServer);
  assert.equal(state.saved, fromServer); // nada pendente
});

test("saved: edição feita durante o salvamento não se perde", () => {
  const sent = page();
  let state = historyReducer(initialHistory, { type: "start", doc: sent });
  // a pessoa digita enquanto o PUT está em andamento
  state = historyReducer(state, { type: "set", path: ["sections", 0, "title"], value: "Digitado depois", time: 1 });
  const typed = state.doc;
  state = historyReducer(state, { type: "saved", sent, doc: page() });
  assert.equal(state.doc, typed);
  assert.equal(state.doc.sections[0].title, "Digitado depois");
  assert.equal(state.saved, sent);
  assert.notEqual(state.doc, state.saved); // continua "alterações não salvas"
});

test("bloco novo começa com a opção padrão dos campos de escolha (ex.: fundo automático)", () => {
  const withChoice = { ...schema, blocks: { ...schema.blocks, faq: { fields: {
    ...schema.blocks.faq.fields,
    background: { type: "choice", options: { auto: "Automático", dark: "Escuro" }, default: "auto" },
  } } } };
  assert.equal(newBlock("faq", withChoice).background, "auto");
});

test("hasText: só os campos de texto contam (o ícone padrão de um item novo, não)", () => {
  const fields = { icon: { type: "icon" }, title: { type: "text" }, text: { type: "textarea" } };
  assert.equal(hasText({ icon: "check", title: "", text: " " }, fields), false);
  assert.equal(hasText({ icon: "check", title: "", text: "Algo" }, fields), true);
});
