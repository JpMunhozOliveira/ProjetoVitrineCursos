// Testes da validação das empresas (aba Empresas do painel). Rodar: npm test (node --test)
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { normalizeBrandBody } = require("../lib/brand-input");

const LOGO = "0b6f3c1e-8a2d-4c5e-9f10-1234567890ab";

test("aceita nome, logo ou os dois", () => {
  assert.deepEqual(normalizeBrandBody({ name: "  Coutinho Treinamentos ", logo_id: null }).value,
    { name: "Coutinho Treinamentos", logoId: null, iconId: null });
  assert.deepEqual(normalizeBrandBody({ name: "", logo_id: LOGO }).value, { name: null, logoId: LOGO, iconId: null });
  assert.deepEqual(normalizeBrandBody({ name: "X", logo_id: LOGO, icon_id: LOGO }).value, { name: "X", logoId: LOGO, iconId: LOGO });
});

test("exige nome ou logo", () => {
  for (const body of [{}, { name: "   " }, { name: null, logo_id: null }]) {
    assert.match(normalizeBrandBody(body).error, /nome da empresa, o logo/);
  }
});

test("recusa campos desconhecidos, tipos errados e tamanhos acima do limite", () => {
  assert.match(normalizeBrandBody({ name: "X", brand_name: "Y" }).error, /não suportado/);
  assert.match(normalizeBrandBody({ name: 1 }).error, /texto/);
  assert.match(normalizeBrandBody({ name: "x".repeat(81) }).error, /80 caracteres/);
  assert.match(normalizeBrandBody({ name: "X", logo_id: "../etc/passwd" }).error, /logo_id inválido/);
  assert.match(normalizeBrandBody({ name: "X", icon_id: "abc" }).error, /icon_id inválido/);
  for (const body of [null, [], "x"]) assert.match(normalizeBrandBody(body).error, /objeto JSON/);
});
