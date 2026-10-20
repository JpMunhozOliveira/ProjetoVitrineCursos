// Utilitários de segurança sem dependências externas (somente node:crypto).
const crypto = require("node:crypto");
const { promisify } = require("node:util");
const scrypt = promisify(crypto.scrypt);

// scrypt com os parâmetros guardados no próprio hash (dá para endurecer depois).
const N = 32768, R = 8, P = 3, KEYLEN = 64;
const scryptOpts = (n, r, p) => ({ N: n, r, p, maxmem: 128 * n * r * 2 });
const normalize = (s) => String(s).normalize("NFKC");

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(normalize(password), salt, KEYLEN, scryptOpts(N, R, P));
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

let dummyHash; // usado quando o e-mail não existe, para não revelar isso pelo tempo de resposta
async function verifyPassword(password, stored) {
  if (!stored) {
    dummyHash ??= hashPassword("senha-inexistente");
    stored = await dummyHash;
    await verifyPassword(password, stored);
    return false;
  }
  const [scheme, n, r, p, salt, key] = String(stored).split("$");
  if (scheme !== "scrypt" || !key) return false;
  const expected = Buffer.from(key, "base64");
  const actual = await scrypt(normalize(password), Buffer.from(salt, "base64"), expected.length,
    scryptOpts(Number(n), Number(r), Number(p)));
  return crypto.timingSafeEqual(actual, expected);
}

const randomToken = () => crypto.randomBytes(32).toString("base64url");
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function parseCookies(header = "") {
  const out = {};
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* ignora */ }
  }
  return out;
}

// Limitador de tentativas em memória (suficiente para uma instância).
// hit() deve ser chamado ANTES da operação lenta (ex.: conferir a senha), na mesma passagem que
// isBlocked(): se contar só depois do await, requisições simultâneas passam todas pelo bloqueio.
// Memória limitada: acima de maxKeys, a faxina (no máximo 1x por minuto, para não percorrer o
// Map a cada requisição) remove as expiradas e, se ainda faltar espaço, as mais antigas.
function createLimiter({ max, windowMs, maxKeys = 5000 }) {
  const hits = new Map(); // ordem de inserção = ordem de criação (a mais antiga primeiro)
  let lastSweep = 0;
  const live = (key) => {
    const h = hits.get(key);
    if (h && h.resetAt <= Date.now()) { hits.delete(key); return null; }
    return h || null;
  };
  function sweep() {
    const now = Date.now();
    if (now - lastSweep >= 60_000) {
      lastSweep = now;
      for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    }
    for (const k of hits.keys()) { if (hits.size < maxKeys) break; hits.delete(k); }
  }
  return {
    isBlocked: (key) => (live(key)?.count ?? 0) >= max,
    hit(key) {
      if (hits.size >= maxKeys && !hits.has(key)) sweep();
      const h = live(key) || { count: 0, resetAt: Date.now() + windowMs };
      h.count += 1; hits.set(key, h);
    },
    clear: (key) => hits.delete(key),
  };
}

module.exports = { hashPassword, verifyPassword, randomToken, sha256, safeEqual, parseCookies, createLimiter };
