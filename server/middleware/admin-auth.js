const pool = require("../config/database");
const { sha256, safeEqual, parseCookies } = require("../lib/security");

const COOKIE = "vitrine_admin";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Aceita (1) sessão por cookie do painel ou (2) chave de API (scripts/automações).
async function requireAdmin(req, res, next) {
  const apiKey = req.get("x-admin-api-key");
  if (apiKey !== undefined) {
    const expected = process.env.ADMIN_API_KEY;
    if (!expected) return res.status(503).json({ error: "Admin API is not configured." });
    if (!safeEqual(apiKey, expected)) return res.status(401).json({ error: "Invalid or missing admin key." });
    req.admin = { via: "api-key" };
    return next();
  }

  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (!token) return res.status(401).json({ error: "Autenticação necessária." });

  const { rows } = await pool.query(
    `SELECT s.id, s.csrf_token, u.id AS user_id, u.email
       FROM admin_sessions s JOIN admin_users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [sha256(token)]
  );
  if (!rows.length) return res.status(401).json({ error: "Sessão expirada. Entre novamente." });
  const s = rows[0];

  // Proteção CSRF: em requisições que alteram dados, exige origem igual e o token do cabeçalho.
  if (!SAFE_METHODS.has(req.method)) {
    const origin = req.get("origin");
    if (origin) {
      let sameHost = false;
      try { sameHost = new URL(origin).host === req.get("host"); } catch { /* origem inválida */ }
      if (!sameHost) return res.status(403).json({ error: "Origem não permitida." });
    }
    if (!safeEqual(req.get("x-csrf-token") || "", s.csrf_token)) {
      return res.status(403).json({ error: "Token CSRF inválido." });
    }
  }

  req.admin = { via: "session", sessionId: s.id, userId: s.user_id, email: s.email, csrfToken: s.csrf_token };
  return next();
}

module.exports = requireAdmin;
module.exports.COOKIE = COOKIE;
