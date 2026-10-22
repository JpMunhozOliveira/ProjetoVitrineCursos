// Testes da categoria fixa dos produtos (lib/categories.js). Rodar: npm test (node --test)
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { normalizeCategory } = require("../lib/categories");

test("aceita só as categorias da lista; vazio vira sem categoria", () => {
  assert.deepEqual(normalizeCategory("Curso"), { value: "Curso" });
  assert.deepEqual(normalizeCategory(" Manual "), { value: "Manual" });
  assert.deepEqual(normalizeCategory(""), { value: null });
  assert.deepEqual(normalizeCategory(null), { value: null });
  assert.match(normalizeCategory("Coleção Manuais Práticos").error, /Categoria inválida/);
  assert.match(normalizeCategory("curso").error, /Categoria inválida/);
  assert.match(normalizeCategory(3).error, /Categoria inválida/);
});
