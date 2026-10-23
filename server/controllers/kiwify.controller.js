// Conta Kiwify de cada empresa (aba Empresas) e lista de produtos dela (seletor em "Editar produto").
// As chaves só entram (PUT); nenhuma rota devolve o client_secret.
const pool = require("../config/database");
const box = require("../lib/crypto-box");
const kiwify = require("../lib/kiwify");
const { requireAccount } = require("../lib/kiwify-sync");
const { UUID } = require("../lib/brand-input");

const { KiwifyError } = kiwify;
const NOT_FOUND = { error: "Empresa não encontrada." };
const ACCOUNT_RE = /^[\w-]{1,100}$/;
const SECRET_RE = /^[\x21-\x7e]{8,256}$/; // caracteres visíveis, sem espaços

const clean = (value) => (typeof value === "string" ? value.trim() : "");

// Erros da Kiwify viram mensagens para o painel; o resto segue para o tratador geral (500).
function handle(res, error) {
  if (error instanceof KiwifyError) return res.status(error.status).json({ error: error.message });
  throw error;
}

async function brandExists(id) {
  if (!UUID.test(id)) return false;
  const { rowCount } = await pool.query("SELECT 1 FROM brands WHERE id = $1", [id]);
  return rowCount > 0;
}

// Conecta (ou troca) a conta: testa as chaves pedindo um token antes de gravar.
async function connectAccount(req, res) {
  if (!(await brandExists(req.params.id))) return res.status(404).json(NOT_FOUND);
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const account = {
    key: `test:${req.params.id}`, // token de teste fica separado do token em uso
    account_id: clean(body.account_id), client_id: clean(body.client_id), client_secret: clean(body.client_secret),
  };
  if (!ACCOUNT_RE.test(account.account_id)) return res.status(400).json({ error: "Account ID inválido. Copie-o da Kiwify em Apps > API." });
  if (!ACCOUNT_RE.test(account.client_id)) return res.status(400).json({ error: "Client ID inválido. Copie-o da Kiwify em Apps > API." });
  if (!SECRET_RE.test(account.client_secret)) return res.status(400).json({ error: "Client Secret inválido. Copie-o da Kiwify em Apps > API." });
  if (!box.isConfigured()) {
    return res.status(503).json({ error: "A integração não está configurada no servidor: falta KIWIFY_ENCRYPTION_KEY no .env (veja docs/DEPLOY.md)." });
  }

  try {
    await kiwify.listProducts(account); // pede um token (confere as chaves) e lista (confere o Account ID)
  } catch (error) {
    return handle(res, error);
  } finally {
    kiwify.forget(account.key);
  }

  await pool.query(
    `INSERT INTO kiwify_accounts (brand_id, account_id, client_id, secret_enc) VALUES ($1, $2, $3, $4)
     ON CONFLICT (brand_id) DO UPDATE SET account_id = EXCLUDED.account_id, client_id = EXCLUDED.client_id,
       secret_enc = EXCLUDED.secret_enc, updated_at = CURRENT_TIMESTAMP`,
    [req.params.id, account.account_id, account.client_id, box.encrypt(account.client_secret, req.params.id)]);
  kiwify.forget(req.params.id);
  return res.json({ data: { account_id: account.account_id, client_id_hint: account.client_id.slice(-4) } });
}

// Desconecta: os produtos vinculados mantêm o último preço e link (e passam a mostrar o aviso).
async function disconnectAccount(req, res) {
  if (!UUID.test(req.params.id)) return res.status(404).json(NOT_FOUND);
  await pool.query("DELETE FROM kiwify_accounts WHERE brand_id = $1", [req.params.id]);
  kiwify.forget(req.params.id);
  return res.status(204).end();
}

async function listAccountProducts(req, res) {
  if (!UUID.test(req.params.id)) return res.status(404).json(NOT_FOUND);
  try {
    return res.json({ data: await kiwify.listProducts(await requireAccount(req.params.id)) });
  } catch (error) {
    return handle(res, error);
  }
}

// Um produto com seus links de checkout (preço de cada um).
async function getAccountProduct(req, res) {
  if (!UUID.test(req.params.id)) return res.status(404).json(NOT_FOUND);
  try {
    const product = await kiwify.getProduct(await requireAccount(req.params.id), req.params.productId);
    return res.json({ data: kiwify.summarize(product) });
  } catch (error) {
    return handle(res, error);
  }
}

module.exports = { connectAccount, disconnectAccount, listAccountProducts, getAccountProduct };
