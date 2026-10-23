// Oferta do produto (preço "de/por" e prazo): lib/offer.js e o desenho na página de vendas.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { effectiveOffer, formatEnd } = require("../lib/offer");
const { renderSalesPage } = require("../sales/render");

const NOW = Date.parse("2026-10-23T12:00:00Z");
const base = {
  price_cents: 19700, checkout_url: "https://pay.kiwify.com.br/Normal1",
  offer_price_cents: 9700, offer_checkout_url: "https://pay.kiwify.com.br/Promo01",
  offer_ends_at: "2026-10-25T23:59:00-03:00",
};

test("oferta: ativa troca preço e link e informa o 'de' e o prazo", () => {
  assert.deepEqual(effectiveOffer(base, NOW), {
    active: true, price_cents: 9700, checkout_url: "https://pay.kiwify.com.br/Promo01",
    compare_cents: 19700, ends_at: "2026-10-26T02:59:00.000Z",
  });
});

test("oferta: prazo vencido (inclusive no segundo exato), preço não menor ou sem link -> preço normal", () => {
  const regular = { active: false, price_cents: 19700, checkout_url: base.checkout_url, compare_cents: null, ends_at: null };
  assert.deepEqual(effectiveOffer({ ...base, offer_ends_at: "2026-10-23T11:59:59Z" }, NOW), regular);
  assert.deepEqual(effectiveOffer({ ...base, offer_ends_at: new Date(NOW) }, NOW), regular);
  assert.deepEqual(effectiveOffer({ ...base, offer_price_cents: 19700 }, NOW), regular);
  assert.deepEqual(effectiveOffer({ ...base, offer_checkout_url: null }, NOW), regular);
  assert.deepEqual(effectiveOffer({ ...base, offer_price_cents: null }, NOW), regular);
});

test("oferta: sem prazo vale sempre (só 'de/por', sem cronômetro)", () => {
  const offer = effectiveOffer({ ...base, offer_ends_at: null }, NOW);
  assert.equal(offer.active, true);
  assert.equal(offer.ends_at, null);
});

test("oferta: data por extenso no horário de Brasília", () => {
  assert.equal(formatEnd("2026-10-26T02:59:00.000Z"), "25/10 às 23:59");
});

/* ---------- Página de vendas ---------- */
const page = (product, now = NOW) => renderSalesPage({
  title: "Manual", slug: "manual", short_description: "", status: "published", image_id: null,
  brand_name: null, brand_logo_id: null, theme: null, published_at: null, media: new Map(),
  sections: [
    { type: "hero", title: "T", price_label: "", cta_label: "" },
    { type: "cta", title: "Pronto?", cta_label: "" },
    { type: "offer", title: "Oferta", price_label: "", cta_label: "" },
  ],
  ...product,
}, { baseUrl: "http://localhost", now });

test("página: oferta ativa usa o link promocional, mostra 'de/por' e o cronômetro em cada bloco de compra", () => {
  const html = page(base);
  assert.ok(!html.includes("Normal1"), "o link normal não deve aparecer durante a oferta");
  assert.equal(html.match(/href="https:\/\/pay\.kiwify\.com\.br\/Promo01"/g).length, 3);
  assert.equal(html.match(/<s class="price-was"><span class="sr-only">De <\/span>R\$\s197,00<\/s>/g).length, 3);
  assert.equal(html.match(/class="offer-timer" data-ends-at="2026-10-26T02:59:00\.000Z" data-now="2026-10-23T12:00:00\.000Z"/g).length, 3);
  assert.match(html, /Oferta válida até 25\/10 às 23:59/);
});

test("página: oferta encerrada volta ao link e preço normais e não vaza o link promocional", () => {
  const html = page(base, Date.parse("2026-10-26T03:00:00Z"));
  assert.ok(!html.includes("Promo01"));
  assert.ok(!html.includes("price-was"));
  assert.ok(!html.includes("offer-timer"));
  assert.match(html, /href="https:\/\/pay\.kiwify\.com\.br\/Normal1"/);
  assert.match(html, /R\$\s197,00/);
});

test("página: oferta sem prazo mostra 'de/por' sem cronômetro", () => {
  const html = page({ ...base, offer_ends_at: null });
  assert.match(html, /price-was/);
  assert.ok(!html.includes("offer-timer"));
});
