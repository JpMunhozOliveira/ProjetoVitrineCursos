// Aba Resumo do painel: visitas, cliques em "comprar" e vendas da Kiwify no período escolhido.
// Tudo agregado aqui no banco; o navegador só desenha.
const pool = require("../config/database");
const { TIME_ZONE } = require("../lib/analytics");
const { syncAllSales } = require("../lib/kiwify-sales-sync");

const PERIODS = new Set([7, 30, 90]);
// Situações da Kiwify que contam como venda feita (dinheiro entrou ou vai entrar).
const PAID = "('paid', 'approved', 'authorized', 'complete')";
const LOST = "('refunded', 'chargedback')";
// "Visitas" = visitantes diferentes por dia, somados no período (o resumo do visitante muda todo dia).
const VISIT = `(date_trunc('day', occurred_at AT TIME ZONE '${TIME_ZONE}'), visitor_hash)`;
const SOURCE = "COALESCE(utm_source, ref_host, 'direto')";

async function bounds(days) {
  const { rows: [b] } = await pool.query(
    `SELECT (date_trunc('day', now() AT TIME ZONE $1) - make_interval(days => $2::int - 1)) AT TIME ZONE $1 AS start,
            (date_trunc('day', now() AT TIME ZONE $1) - make_interval(days => 2 * $2::int - 1)) AT TIME ZONE $1 AS prev_start,
            now() AS end`, [TIME_ZONE, days]);
  return b;
}

async function totals(from, to) {
  const { rows: [e] } = await pool.query(
    `SELECT COUNT(DISTINCT ${VISIT}) FILTER (WHERE type = 'view')::int AS visits,
            COUNT(*) FILTER (WHERE type = 'view')::int AS views,
            COUNT(*) FILTER (WHERE type = 'checkout_click')::int AS clicks,
            COUNT(DISTINCT ${VISIT}) FILTER (WHERE type = 'checkout_click')::int AS clickers
       FROM site_events WHERE occurred_at >= $1 AND occurred_at < $2`, [from, to]);
  const { rows: [s] } = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE status IN ${PAID})::int AS sales,
            COALESCE(SUM(net_cents) FILTER (WHERE status IN ${PAID}), 0)::bigint AS revenue_cents,
            COUNT(*) FILTER (WHERE status IN ${LOST})::int AS refunds
       FROM kiwify_sales WHERE created_at >= $1 AND created_at < $2`, [from, to]);
  return { ...e, sales: s.sales, revenue_cents: Number(s.revenue_cents), refunds: s.refunds };
}

async function daily(from, to) {
  const { rows } = await pool.query(
    `WITH days AS (
       SELECT generate_series(date_trunc('day', $1::timestamptz AT TIME ZONE $3),
                              date_trunc('day', $2::timestamptz AT TIME ZONE $3), interval '1 day')::date AS day),
     ev AS (
       SELECT (occurred_at AT TIME ZONE $3)::date AS day,
              COUNT(DISTINCT visitor_hash) FILTER (WHERE type = 'view')::int AS visits,
              COUNT(*) FILTER (WHERE type = 'checkout_click')::int AS clicks
         FROM site_events WHERE occurred_at >= $1 AND occurred_at < $2 GROUP BY 1),
     sa AS (
       SELECT (created_at AT TIME ZONE $3)::date AS day, COUNT(*)::int AS sales
         FROM kiwify_sales WHERE created_at >= $1 AND created_at < $2 AND status IN ${PAID} GROUP BY 1)
     SELECT to_char(d.day, 'YYYY-MM-DD') AS day, COALESCE(ev.visits, 0) AS visits,
            COALESCE(ev.clicks, 0) AS clicks, COALESCE(sa.sales, 0) AS sales
       FROM days d LEFT JOIN ev USING (day) LEFT JOIN sa USING (day) ORDER BY d.day`, [from, to, TIME_ZONE]);
  return rows;
}

async function byProduct(from, to) {
  const { rows } = await pool.query(
    `WITH ev AS (
       SELECT product_id,
              COUNT(DISTINCT ${VISIT}) FILTER (WHERE type = 'view')::int AS visits,
              COUNT(*) FILTER (WHERE type = 'checkout_click')::int AS clicks
         FROM site_events WHERE occurred_at >= $1 AND occurred_at < $2 AND product_id IS NOT NULL GROUP BY 1),
     sa AS (
       SELECT kiwify_product_id, MAX(product_name) AS name, COUNT(*)::int AS sales, SUM(net_cents)::bigint AS revenue_cents
         FROM kiwify_sales WHERE created_at >= $1 AND created_at < $2 AND status IN ${PAID} GROUP BY 1)
     SELECT p.id, p.title, p.slug, COALESCE(ev.visits, 0) AS visits, COALESCE(ev.clicks, 0) AS clicks,
            COALESCE(sa.sales, 0) AS sales, COALESCE(sa.revenue_cents, 0)::bigint AS revenue_cents
       FROM products p
       LEFT JOIN ev ON ev.product_id = p.id
       LEFT JOIN sa ON sa.kiwify_product_id = p.kiwify_product_id
      WHERE ev.product_id IS NOT NULL OR sa.kiwify_product_id IS NOT NULL OR p.status = 'published'
     UNION ALL
     SELECT NULL, COALESCE(sa.name, 'Outro produto da Kiwify'), NULL, 0, 0, sa.sales, sa.revenue_cents
       FROM sa WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.kiwify_product_id = sa.kiwify_product_id)
     ORDER BY sales DESC, visits DESC, title`, [from, to]);
  return rows.map((r) => ({ ...r, revenue_cents: Number(r.revenue_cents) }));
}

// Origem: utm_source do link, senão o site de onde a pessoa veio, senão "direto".
async function bySource(from, to) {
  const { rows: ev } = await pool.query(
    `SELECT ${SOURCE} AS source,
            COUNT(DISTINCT ${VISIT}) FILTER (WHERE type = 'view')::int AS visits,
            COUNT(*) FILTER (WHERE type = 'checkout_click')::int AS clicks
       FROM site_events WHERE occurred_at >= $1 AND occurred_at < $2 GROUP BY 1`, [from, to]);
  const { rows: sa } = await pool.query(
    `SELECT COALESCE(utm_source, 'sem origem') AS source, COUNT(*)::int AS sales,
            SUM(net_cents)::bigint AS revenue_cents
       FROM kiwify_sales WHERE created_at >= $1 AND created_at < $2 AND status IN ${PAID} GROUP BY 1`, [from, to]);
  const map = new Map(ev.map((r) => [r.source, { ...r, sales: 0, revenue_cents: 0 }]));
  for (const r of sa) {
    const row = map.get(r.source) || { source: r.source, visits: 0, clicks: 0, sales: 0, revenue_cents: 0 };
    row.sales = r.sales;
    row.revenue_cents = Number(r.revenue_cents);
    map.set(r.source, row);
  }
  return [...map.values()].sort((a, b) => b.sales - a.sales || b.visits - a.visits).slice(0, 15);
}

async function byDevice(from, to) {
  const { rows } = await pool.query(
    `SELECT device, COUNT(DISTINCT ${VISIT})::int AS visits
       FROM site_events WHERE occurred_at >= $1 AND occurred_at < $2 AND type = 'view'
      GROUP BY 1 ORDER BY 2 DESC`, [from, to]);
  return rows;
}

async function topPages(from, to) {
  const { rows } = await pool.query(
    `SELECT path, COUNT(*)::int AS views
       FROM site_events WHERE occurred_at >= $1 AND occurred_at < $2 AND type = 'view'
      GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 10`, [from, to]);
  return rows;
}

// Pagamentos por empresa com conta Kiwify conectada, contados nas vendas copiadas (o resumo pronto
// da Kiwify, GET /stats, devolve números inconsistentes, como 600% de cartões aprovados).
async function kiwifyByBrand(from, to) {
  const { rows } = await pool.query(
    `SELECT b.name AS brand, a.sales_synced_at AS synced_at, a.sales_sync_error AS sync_error,
            COUNT(s.*) FILTER (WHERE s.status IN ${PAID})::int AS paid,
            COUNT(s.*) FILTER (WHERE s.status IN ('waiting_payment', 'pending', 'processing'))::int AS waiting,
            COUNT(s.*) FILTER (WHERE s.status = 'refused')::int AS refused,
            COUNT(s.*) FILTER (WHERE s.status IN ${LOST} OR s.status IN ('refund_requested', 'pending_refund'))::int AS refunds,
            COUNT(s.*) FILTER (WHERE s.status IN ${PAID} AND s.payment_method = 'pix')::int AS pix,
            COUNT(s.*) FILTER (WHERE s.status IN ${PAID} AND s.payment_method = 'credit_card')::int AS card,
            COUNT(s.*) FILTER (WHERE s.status IN ${PAID} AND s.payment_method = 'boleto')::int AS boleto
       FROM kiwify_accounts a
       JOIN brands b ON b.id = a.brand_id
       LEFT JOIN kiwify_sales s ON s.brand_id = a.brand_id AND s.created_at >= $1 AND s.created_at < $2
      GROUP BY b.name, a.sales_synced_at, a.sales_sync_error ORDER BY b.name`, [from, to]);
  return rows;
}

async function warnings() {
  const { rows } = await pool.query(
    `SELECT id, title, kiwify_sync_error FROM products WHERE kiwify_sync_error IS NOT NULL ORDER BY title LIMIT 10`);
  return rows.map((r) => ({ product_id: r.id, title: r.title, message: r.kiwify_sync_error }));
}

async function getDashboard(req, res) {
  const days = Number(req.query.days || 30);
  if (!PERIODS.has(days)) return res.status(400).json({ error: "Período inválido (use 7, 30 ou 90 dias)." });
  const b = await bounds(days);
  const [current, previous, series, products, sources, devices, pages, kiwify, alerts] = await Promise.all([
    totals(b.start, b.end), totals(b.prev_start, b.start), daily(b.start, b.end), byProduct(b.start, b.end),
    bySource(b.start, b.end), byDevice(b.start, b.end), topPages(b.start, b.end), kiwifyByBrand(b.start, b.end), warnings(),
  ]);
  const { rows: [{ any }] } = await pool.query("SELECT EXISTS (SELECT 1 FROM site_events) AS any");
  return res.json({ data: {
    days, start: b.start, end: b.end, has_events: any,
    totals: current, previous, daily: series, products, sources, devices, pages, kiwify, warnings: alerts,
  } });
}

// "Atualizar vendas": busca na Kiwify agora (em vez de esperar a próxima hora).
async function refreshSales(_req, res) {
  const result = await syncAllSales();
  return res.json({ data: result });
}

module.exports = { getDashboard, refreshSales };
