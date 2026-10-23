// Preço e link que o site mostra agora: o da oferta (se vale neste momento) ou o normal.
// Fonte única para a página de vendas e o catálogo. A oferta vale quando tem preço e link, o
// preço é menor que o normal e o prazo (se houver) ainda não acabou.
// Devolve { active, price_cents, checkout_url, compare_cents, ends_at }:
//   compare_cents = preço normal ("de"), só com oferta ativa; ends_at = fim em ISO, ou null.
function effectiveOffer(p, now = Date.now()) {
  const regular = {
    active: false, price_cents: p.price_cents ?? null, checkout_url: p.checkout_url || null,
    compare_cents: null, ends_at: null,
  };
  const price = p.offer_price_cents;
  if (price === null || price === undefined || !p.offer_checkout_url) return regular;
  if (p.price_cents !== null && p.price_cents !== undefined && price >= p.price_cents) return regular;
  const ends = p.offer_ends_at ? new Date(p.offer_ends_at) : null;
  if (ends && !(ends.getTime() > now)) return regular;
  return {
    active: true, price_cents: price, checkout_url: p.offer_checkout_url,
    compare_cents: p.price_cents ?? null, ends_at: ends ? ends.toISOString() : null,
  };
}

// Data de fim por extenso no horário de Brasília ("25/10 às 23:59").
function formatEnd(iso) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
  const time = d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  return `${date} às ${time}`;
}

module.exports = { effectiveOffer, formatEnd };
