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
function createLimiter({ max, windowMs }) {
  const hits = new Map();
  const live = (key) => {
    const h = hits.get(key);
    if (h && h.resetAt <= Date.now()) { hits.delete(key); return null; }
    return h || null;
  };
  return {
    isBlocked: (key) => (live(key)?.count ?? 0) >= max,
    fail(key) {
      if (hits.size > 5000) for (const [k, v] of hits) if (v.resetAt <= Date.now()) hits.delete(k);
      const h = live(key) || { count: 0, resetAt: Date.now() + windowMs };
      h.count += 1; hits.set(key, h);
    },
    clear: (key) => hits.delete(key),
  };
}

module.exports = { hashPassword, verifyPassword, randomToken, sha256, safeEqual, parseCookies, createLimiter };
