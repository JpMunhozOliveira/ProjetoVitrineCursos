// Testes da área de conhecimento fixa dos produtos (lib/areas.js). Rodar: npm test (node --test)
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { AREAS, normalizeArea } = require("../lib/areas");

test("aceita só as áreas da lista; vazio vira sem área", () => {
  assert.deepEqual(normalizeArea("Contabilidade"), { value: "Contabilidade" });
  assert.deepEqual(normalizeArea(" Reforma Tributária "), { value: "Reforma Tributária" });
  assert.deepEqual(normalizeArea(""), { value: null });
  assert.deepEqual(normalizeArea(null), { value: null });
  assert.match(normalizeArea("Finanças").error, /inválida/);
  assert.match(normalizeArea("contabilidade").error, /inválida/);
  assert.match(normalizeArea(3).error, /inválida/);
});

test("a lista cabe na coluna (60 caracteres) e não tem repetidas", () => {
  assert.equal(new Set(AREAS).size, AREAS.length);
  AREAS.forEach((a) => assert.ok(a.length <= 60, a));
});
