// Testes da validação das empresas (aba Empresas do painel). Rodar: npm test (node --test)
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { normalizeBrandBody } = require("../lib/brand-input");

const LOGO = "0b6f3c1e-8a2d-4c5e-9f10-1234567890ab";

test("aceita nome, logo ou os dois", () => {
  assert.deepEqual(normalizeBrandBody({ name: "  Coutinho Treinamentos ", logo_id: null }).value,
    { name: "Coutinho Treinamentos", logoId: null, iconId: null, isDefault: false });
  assert.deepEqual(normalizeBrandBody({ name: "", logo_id: LOGO }).value, { name: null, logoId: LOGO, iconId: null, isDefault: false });
  assert.deepEqual(normalizeBrandBody({ name: "X", logo_id: LOGO, icon_id: LOGO, is_default: true }).value,
    { name: "X", logoId: LOGO, iconId: LOGO, isDefault: true });
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
  assert.match(normalizeBrandBody({ name: "X", is_default: "sim" }).error, /is_default/);
  for (const body of [null, [], "x"]) assert.match(normalizeBrandBody(body).error, /objeto JSON/);
});

// Empresa padrão nas páginas do site (lib/site-brand.js).
const { injectSiteBrand } = require("../lib/site-brand");
const PAGE = '<link rel="icon" type="image/png" href="/assets/favicon/favicon.png">\n<div id="site-header"></div>';

test("empresa padrão: menu com nome e logo escapados e ícone da aba trocado", () => {
  const out = injectSiteBrand(PAGE, {
    name: 'Celetivo <b>"', logo: { url: "/uploads/a.webp", width: 400, height: 100, alt: "Logo" }, icon: { url: "/uploads/i.webp" },
  });
  assert.match(out, /<div id="site-header" data-brand-name="Celetivo &lt;b&gt;&quot;" data-brand-logo="\/uploads\/a.webp" data-brand-logo-w="400" data-brand-logo-h="100" data-brand-logo-alt="Logo">/);
  assert.match(out, /<link rel="icon" href="\/uploads\/i.webp">/);
  assert.doesNotMatch(out, /favicon\.png/);
});

test("empresa padrão: sem ícone usa o logo na aba; sem empresa o HTML não muda", () => {
  const out = injectSiteBrand(PAGE, { name: null, logo: { url: "/uploads/a.webp", width: 4, height: 1, alt: "" }, icon: null });
  assert.match(out, /<link rel="icon" href="\/uploads\/a.webp">/);
  assert.match(out, /data-brand-name=""/);
  assert.equal(injectSiteBrand(PAGE, null), PAGE);
  // Só nome: menu com o nome, aba continua com o ícone do site.
  const named = injectSiteBrand(PAGE, { name: "X", logo: null, icon: null });
  assert.match(named, /data-brand-name="X">/);
  assert.match(named, /favicon\.png/);
});
