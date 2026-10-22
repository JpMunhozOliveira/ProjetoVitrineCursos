// Liga a API da Kiwify aos produtos: abre a conta da empresa (segredo criptografado no banco) e
// copia preço e link de checkout do produto vinculado para price_cents / checkout_url.
// Usado ao salvar um produto, pelo botão "Atualizar agora" e pela atualização automática (6 h).
const pool = require("../config/database");
const box = require("./crypto-box");
const kiwify = require("./kiwify");

const { KiwifyError } = kiwify;
const SYNC_EVERY_MS = 6 * 60 * 60 * 1000;

// Conta Kiwify da empresa, pronta para a API (com o segredo aberto), ou null se não houver.
async function loadAccount(brandId) {
  if (!brandId) return null;
  const { rows } = await pool.query(
    "SELECT brand_id, account_id, client_id, secret_enc FROM kiwify_accounts WHERE brand_id = $1", [brandId]);
  if (!rows[0]) return null;
  let secret;
  try {
    secret = box.decrypt(rows[0].secret_enc, rows[0].brand_id);
  } catch (error) {
    throw new KiwifyError(error.code === "NO_MASTER_KEY"
      ? "A integração com a Kiwify não está configurada no servidor (falta KIWIFY_ENCRYPTION_KEY)."
      : "Não foi possível abrir as chaves desta conta Kiwify. Conecte a conta de novo na aba Empresas.", 503);
  }
  return { key: rows[0].brand_id, account_id: rows[0].account_id, client_id: rows[0].client_id, client_secret: secret };
}

async function requireAccount(brandId) {
  const account = await loadAccount(brandId);
  if (!account) throw new KiwifyError("Esta empresa não tem conta Kiwify conectada (conecte-a na aba Empresas).", 400);
  return account;
}

// Preço e link atuais de um produto/link da Kiwify, na conta da empresa.
async function fetchCheckout(brandId, kiwifyProductId, linkId, cache) {
  const account = await requireAccount(brandId);
  const key = `${brandId}:${kiwifyProductId}`;
  let product = cache?.get(key);
  if (!product) {
    product = await kiwify.getProduct(account, kiwifyProductId);
    cache?.set(key, product);
  }
  return kiwify.toCheckout(product, linkId);
}

// Resumo curto para guardar como "último erro" (coluna de 300 caracteres).
const errorText = (error) => (error instanceof KiwifyError ? error.message : "Erro inesperado ao consultar a Kiwify.").slice(0, 300);

// Atualiza um produto vinculado. Falhou? Mantém o último preço/link e grava o erro para o painel.
async function syncProduct(productId, cache) {
  const { rows } = await pool.query(
    "SELECT id, brand_id, kiwify_product_id, kiwify_link_id FROM products WHERE id = $1", [productId]);
  const row = rows[0];
  if (!row) return { found: false };
  if (!row.kiwify_product_id) throw new KiwifyError("Este produto não está vinculado à Kiwify.", 400);
  try {
    const { price_cents: price, checkout_url: url } = await fetchCheckout(row.brand_id, row.kiwify_product_id, row.kiwify_link_id, cache);
    // Só grava se o vínculo não mudou enquanto a Kiwify respondia.
    await pool.query(
      `UPDATE products SET price_cents = $2, checkout_url = $3, kiwify_synced_at = CURRENT_TIMESTAMP,
              kiwify_sync_error = NULL
        WHERE id = $1 AND kiwify_product_id = $4 AND kiwify_link_id = $5`,
      [row.id, price, url, row.kiwify_product_id, row.kiwify_link_id]);
    return { found: true };
  } catch (error) {
    await pool.query("UPDATE products SET kiwify_sync_error = $2 WHERE id = $1", [row.id, errorText(error)]);
    throw error;
  }
}

// Todos os produtos vinculados, um de cada vez (respeita o limite de consultas da Kiwify).
async function syncAll() {
  const { rows } = await pool.query(
    "SELECT id FROM products WHERE kiwify_product_id IS NOT NULL ORDER BY brand_id, kiwify_product_id");
  const cache = new Map();
  let ok = 0, failed = 0;
  for (const { id } of rows) {
    try { await syncProduct(id, cache); ok += 1; } catch (error) {
      failed += 1;
      console.warn(`Kiwify: produto ${id} não atualizado: ${errorText(error)}`);
    }
  }
  if (rows.length) console.log(`Kiwify: ${ok} produto(s) atualizado(s)${failed ? `, ${failed} com erro` : ""}.`);
  return { ok, failed };
}

// Atualização automática: 1 min após subir e depois a cada 6 h. unref(): não segura o desligamento.
function startAutoSync() {
  const run = () => syncAll().catch((error) => console.error("Kiwify: atualização automática falhou:", error.message));
  setTimeout(run, 60_000).unref();
  setInterval(run, SYNC_EVERY_MS).unref();
}

module.exports = { loadAccount, requireAccount, fetchCheckout, syncProduct, syncAll, startAutoSync, errorText };
