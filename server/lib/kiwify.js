// Cliente da API pública da Kiwify (https://docs.kiwify.com.br). Só leitura de produtos: o painel
// usa para puxar preço e link de checkout. Cuidados:
//  - endereço fixo (BASE): nada vindo do painel muda o servidor chamado; IDs passam por ID_RE;
//  - o token de acesso fica só em memória, por conta, e é renovado 5 min antes de vencer;
//  - mensagens de erro resumidas: nunca incluem o client_secret nem o corpo enviado;
//  - limite próprio de 60 chamadas/min por conta (a Kiwify corta em 100/min com erro 429).
const { createLimiter } = require("./security");

const BASE = "https://public-api.kiwify.com/v1";
const CHECKOUT_BASE = "https://pay.kiwify.com.br/";
const ID_RE = /^[\w-]{1,64}$/;
const TIMEOUT_MS = 10_000;
const MAX_PRICE_CENTS = 100_000_000; // mesmo teto do produto (R$ 1.000.000,00)

class KiwifyError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = "KiwifyError";
    this.status = status; // código HTTP a devolver ao painel
  }
}

let fetchImpl = (...args) => globalThis.fetch(...args);
const tokens = new Map(); // account.key -> { value, expiresAt }
let limiter = createLimiter({ max: 60, windowMs: 60_000, maxKeys: 100 });

const isId = (value) => typeof value === "string" && ID_RE.test(value);

// account: { key, account_id, client_id, client_secret } (key = id da empresa).
async function send(path, init) {
  let res;
  try {
    res = await fetchImpl(BASE + path, { ...init, redirect: "error", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new KiwifyError("Não foi possível falar com a Kiwify agora. Tente de novo em instantes.");
  }
  let body = null;
  try { body = await res.json(); } catch { /* resposta sem JSON */ }
  return { status: res.status, body };
}

function checkLimit(account) {
  if (limiter.isBlocked(account.key)) throw new KiwifyError("Muitas consultas à Kiwify em pouco tempo. Aguarde um minuto.", 429);
  limiter.hit(account.key);
}

async function getToken(account, { fresh = false } = {}) {
  const cached = tokens.get(account.key);
  if (!fresh && cached && cached.expiresAt > Date.now()) return cached.value;

  checkLimit(account);
  const { status, body } = await send("/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ client_id: account.client_id, client_secret: account.client_secret }).toString(),
  });
  if (status === 429) throw new KiwifyError("A Kiwify está recebendo muitas consultas. Tente em instantes.", 429);
  if (status !== 200 || !body || typeof body.access_token !== "string") {
    tokens.delete(account.key);
    throw new KiwifyError("A Kiwify recusou as chaves desta conta. Confira o Client ID e o Client Secret.", 400);
  }
  const seconds = Number(body.expires_in);
  const lifetime = Number.isFinite(seconds) && seconds > 0 ? seconds : 3600;
  tokens.set(account.key, { value: body.access_token, expiresAt: Date.now() + Math.max(lifetime - 300, 30) * 1000 });
  return body.access_token;
}

// GET autenticado. Token recusado (401/403) -> pede outro e tenta uma única vez de novo.
async function get(account, path) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const token = await getToken(account, { fresh: attempt > 0 });
    checkLimit(account);
    const { status, body } = await send(path, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, "x-kiwify-account-id": account.account_id, Accept: "application/json" },
    });
    if (status === 200 && body) return body;
    if (status === 401 || status === 403) { tokens.delete(account.key); continue; }
    if (status === 404) throw new KiwifyError("Produto não encontrado nesta conta da Kiwify.", 404);
    if (status === 429) throw new KiwifyError("A Kiwify está recebendo muitas consultas. Tente em instantes.", 429);
    if (status === 400) throw new KiwifyError("A Kiwify recusou o acesso. Confira o Account ID desta conta.", 400);
    throw new KiwifyError(`A Kiwify respondeu com erro (${status}). Tente de novo em instantes.`);
  }
  throw new KiwifyError("A Kiwify recusou o acesso desta conta. Conecte a conta de novo na aba Empresas.", 400);
}

// Preço da Kiwify em centavos (ex.: 500 = R$ 5,00). Ausente ou fora do esperado -> null (site oculta o preço).
function toCents(value) {
  const n = Number(value);
  if (value === null || value === undefined || value === "" || !Number.isFinite(n) || n < 0) return null;
  const cents = Math.round(n);
  return cents <= MAX_PRICE_CENTS ? cents : null;
}

const linkName = (link, index) => link.custom_name || (link.is_sales_page ? "Página de vendas" : `Link ${index + 1}`);

// Resumo para o painel (sem campos internos da Kiwify).
function summarize(product) {
  return {
    id: product.id,
    name: product.name,
    status: product.status,
    price_cents: toCents(product.price),
    links: Array.isArray(product.links)
      ? product.links.filter((l) => l && isId(l.id)).map((l, i) => ({
        id: l.id, name: linkName(l, i), status: l.status,
        price_cents: toCents(l.price ?? product.price), checkout_url: CHECKOUT_BASE + l.id,
      }))
      : undefined,
  };
}

// Lista todos os produtos da conta (paginado; no máximo 20 páginas de 100).
async function listProducts(account) {
  const all = [];
  for (let page = 1; page <= 20; page += 1) {
    const body = await get(account, `/products?page_size=100&page_number=${page}`);
    const items = Array.isArray(body.data) ? body.data : [];
    all.push(...items.filter((p) => p && isId(p.id)));
    const total = Number(body.pagination?.count);
    if (!items.length || items.length < 100 || (Number.isFinite(total) && all.length >= total)) break;
  }
  return all.map((p) => { const { links, ...rest } = summarize(p); return rest; })
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "pt-BR"));
}

async function getProduct(account, productId) {
  if (!isId(productId)) throw new KiwifyError("ID de produto da Kiwify inválido.", 400);
  return get(account, `/products/${encodeURIComponent(productId)}`);
}

// Preço e link de checkout de um link do produto (o link pode ter preço próprio).
function toCheckout(product, linkId) {
  const link = summarize(product).links?.find((l) => l.id === linkId);
  if (!link) throw new KiwifyError("Este link de checkout não existe mais no produto da Kiwify. Escolha outro.", 404);
  if (link.status && link.status !== "active") throw new KiwifyError("Este link de checkout está desativado na Kiwify. Escolha outro.", 400);
  return { price_cents: link.price_cents, checkout_url: link.checkout_url };
}

/* ---------- Vendas (aba Resumo do painel) ---------- */
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const tag = (value) => (typeof value === "string" && value.trim() ? value.trim().toLowerCase().slice(0, 100) : null);
const date = (value) => {
  const d = typeof value === "string" && value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
};

// Só os campos usados nos números do painel. Nome, e-mail, CPF, endereço e cartão do comprador
// (que a Kiwify também manda) ficam de fora de propósito.
function toSale(sale) {
  if (!sale || !isId(sale.id) || !date(sale.created_at)) return null;
  const tracking = sale.tracking && typeof sale.tracking === "object" ? sale.tracking : {};
  const product = sale.product && typeof sale.product === "object" ? sale.product : {};
  return {
    order_id: sale.id,
    kiwify_product_id: isId(product.id) ? product.id : null,
    product_name: typeof product.name === "string" ? product.name.slice(0, 200) : null,
    status: typeof sale.status === "string" ? sale.status.slice(0, 30) : "unknown",
    payment_method: typeof sale.payment_method === "string" ? sale.payment_method.slice(0, 30) : null,
    charge_cents: toCents(sale.payment?.charge_amount),
    net_cents: toCents(sale.payment?.net_amount ?? sale.net_amount),
    created_at: date(sale.created_at),
    approved_at: date(sale.approved_date),
    utm_source: tag(tracking.utm_source),
    utm_medium: tag(tracking.utm_medium),
    utm_campaign: tag(tracking.utm_campaign),
  };
}

function checkRange(start, end) {
  if (!DAY_RE.test(start) || !DAY_RE.test(end)) throw new KiwifyError("Período inválido.", 400);
}

// Vendas criadas entre start e end (AAAA-MM-DD, no máximo 90 dias; regra da Kiwify).
async function listSales(account, { start, end }) {
  checkRange(start, end);
  const all = [];
  for (let page = 1; page <= 50; page += 1) {
    const query = new URLSearchParams({
      start_date: start, end_date: end, view_full_sale_details: "true", page_size: "100", page_number: String(page),
    });
    const body = await get(account, `/sales?${query}`);
    const items = Array.isArray(body.data) ? body.data : [];
    for (const item of items) { const sale = toSale(item); if (sale) all.push(sale); }
    const total = Number(body.pagination?.count);
    if (!items.length || items.length < 100 || (Number.isFinite(total) && page * 100 >= total)) break;
  }
  return all;
}

const forget = (key) => tokens.delete(key);

module.exports = {
  KiwifyError, isId, getToken, listProducts, getProduct, summarize, toCheckout, toCents, forget,
  toSale, listSales,
  _setFetch: (fn) => { fetchImpl = fn; tokens.clear(); limiter = createLimiter({ max: 60, windowMs: 60_000, maxKeys: 100 }); }, // só para os testes
};
