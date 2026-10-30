// Copia as vendas de cada conta Kiwify conectada para a tabela kiwify_sales (aba Resumo do painel).
// A cada hora busca as vendas dos últimos 3 dias; uma vez por dia (e ao subir o servidor) revê os
// últimos 90 dias, para pegar reembolsos e boletos pagos depois. Só campos sem dado pessoal
// (ver kiwify.toSale).
const pool = require("../config/database");
const kiwify = require("./kiwify");
const { loadAccount, errorText } = require("./kiwify-sync");
const { TIME_ZONE } = require("./analytics");

const EVERY_MS = 60 * 60 * 1000;
const FULL_EVERY_MS = 24 * 60 * 60 * 1000;
const lastFull = new Map(); // brand_id -> quando revisou os 90 dias
let running = null;

// Data AAAA-MM-DD no fuso de Brasília, deslocada "days" dias.
function day(offsetDays = 0) {
  return new Date(Date.now() + offsetDays * 864e5).toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
}

async function saveSales(brandId, sales) {
  for (const s of sales) {
    await pool.query(
      `INSERT INTO kiwify_sales (order_id, brand_id, kiwify_product_id, product_name, status, payment_method,
         charge_cents, net_cents, created_at, approved_at, utm_source, utm_medium, utm_campaign)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (order_id) DO UPDATE SET
         status = EXCLUDED.status, payment_method = EXCLUDED.payment_method,
         charge_cents = EXCLUDED.charge_cents, net_cents = EXCLUDED.net_cents,
         approved_at = EXCLUDED.approved_at, product_name = EXCLUDED.product_name,
         synced_at = CURRENT_TIMESTAMP`,
      [s.order_id, brandId, s.kiwify_product_id, s.product_name, s.status, s.payment_method,
        s.charge_cents, s.net_cents, s.created_at, s.approved_at, s.utm_source, s.utm_medium, s.utm_campaign]);
  }
}

async function syncBrand(brandId) {
  try {
    const account = await loadAccount(brandId);
    if (!account) return 0;
    const full = !lastFull.has(brandId) || Date.now() - lastFull.get(brandId) > FULL_EVERY_MS;
    // A Kiwify aceita no máximo 90 dias entre as datas; o fim vai até amanhã por causa do fuso.
    const sales = await kiwify.listSales(account, { start: day(full ? -88 : -3), end: day(1) });
    await saveSales(brandId, sales);
    if (full) lastFull.set(brandId, Date.now());
    await pool.query("UPDATE kiwify_accounts SET sales_synced_at = CURRENT_TIMESTAMP, sales_sync_error = NULL WHERE brand_id = $1", [brandId]);
    return sales.length;
  } catch (error) {
    await pool.query("UPDATE kiwify_accounts SET sales_sync_error = $2 WHERE brand_id = $1", [brandId, errorText(error)]);
    throw error;
  }
}

// Todas as contas, uma de cada vez. Se já estiver rodando, espera a mesma rodada.
function syncAllSales() {
  running ??= (async () => {
    const { rows } = await pool.query("SELECT brand_id FROM kiwify_accounts ORDER BY brand_id");
    let ok = 0, failed = 0;
    for (const { brand_id: brandId } of rows) {
      try { await syncBrand(brandId); ok += 1; } catch (error) {
        failed += 1;
        console.warn(`Kiwify: vendas da empresa ${brandId} não atualizadas: ${errorText(error)}`);
      }
    }
    return { ok, failed };
  })().finally(() => { running = null; });
  return running;
}

// 2 min após subir e depois a cada 1 h. unref(): não segura o desligamento.
function startSalesSync() {
  const run = () => syncAllSales().catch((error) => console.error("Kiwify: busca de vendas falhou:", error.message));
  setTimeout(run, 120_000).unref();
  setInterval(run, EVERY_MS).unref();
}

module.exports = { syncAllSales, startSalesSync };
