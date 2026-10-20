const pool = require("../config/database");
const sec = require("../lib/security");
const { COOKIE } = require("../middleware/admin-auth");

const SESSION_HOURS = Math.max(1, Math.round(Number(process.env.SESSION_HOURS) || 12));
const WINDOW = 15 * 60 * 1000;
const byIpEmail = sec.createLimiter({ max: 5, windowMs: WINDOW });
const byIp = sec.createLimiter({ max: 30, windowMs: WINDOW });
// Conferir a senha (scrypt) custa ~32 MB e ~100 ms na threadpool do Node, que também processa
// os uploads. Vários IPs ao mesmo tempo não podem ocupá-la toda: acima disso, "tente de novo".
const MAX_CONCURRENT_CHECKS = 4;
let checking = 0;

// Secure (cookie só trafega em HTTPS): COOKIE_SECURE=true, ou automático quando a requisição chegou
// por HTTPS (req.secure; atrás de proxy, depende de TRUST_PROXY).
function sessionCookie(req, value, maxAgeSeconds) {
  const parts = [`${COOKIE}=${value}`, "Path=/", "HttpOnly", "SameSite=Strict", `Max-Age=${maxAgeSeconds}`];
  if (process.env.COOKIE_SECURE === "true" || req.secure) parts.push("Secure");
  return parts.join("; ");
}

async function login(req, res) {
  const { email, password } = req.body || {};
  // E-mail até 254 caracteres (limite da coluna): ele vira chave do limitador, guardada em memória.
  if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password
    || email.length > 254 || password.length > 256) {
    return res.status(400).json({ error: "Informe e-mail e senha." });
  }
  const mail = email.trim().toLowerCase();
  const keyPair = `${req.ip}|${mail}`;

  if (byIpEmail.isBlocked(keyPair) || byIp.isBlocked(req.ip)) {
    res.set("Retry-After", String(WINDOW / 1000));
    return res.status(429).json({ error: "Muitas tentativas. Aguarde alguns minutos e tente de novo." });
  }
  if (checking >= MAX_CONCURRENT_CHECKS) {
    res.set("Retry-After", "2");
    return res.status(429).json({ error: "Servidor ocupado. Tente de novo em alguns segundos." });
  }
  // A tentativa conta já aqui, antes de conferir a senha (ver createLimiter); o acerto zera a contagem.
  byIpEmail.hit(keyPair); byIp.hit(req.ip);

  let ok, rows;
  checking += 1; // na mesma passagem do teste acima (antes de qualquer await)
  try {
    ({ rows } = await pool.query(
      "SELECT id, email, password_hash FROM admin_users WHERE lower(email) = $1", [mail]));
    ok = await sec.verifyPassword(password, rows[0]?.password_hash);
  } finally {
    checking -= 1;
  }
  if (!ok) return res.status(401).json({ error: "E-mail ou senha incorretos." });
  byIpEmail.clear(keyPair);

  const token = sec.randomToken();
  const csrf = sec.randomToken();
  await pool.query("DELETE FROM admin_sessions WHERE expires_at < now()");
  await pool.query(
    `INSERT INTO admin_sessions (user_id, token_hash, csrf_token, expires_at)
     VALUES ($1, $2, $3, now() + make_interval(hours => $4))`,
    [rows[0].id, sec.sha256(token), csrf, SESSION_HOURS]);
  await pool.query("UPDATE admin_users SET last_login_at = now() WHERE id = $1", [rows[0].id]);

  res.set("Set-Cookie", sessionCookie(req, token, SESSION_HOURS * 3600));
  return res.json({ data: { email: rows[0].email, csrfToken: csrf } });
}

function me(req, res) {
  const { via, email = null, csrfToken = null } = req.admin;
  return res.json({ data: { via, email, csrfToken } });
}

async function logout(req, res) {
  if (req.admin.sessionId) await pool.query("DELETE FROM admin_sessions WHERE id = $1", [req.admin.sessionId]);
  res.set("Set-Cookie", sessionCookie(req, "", 0));
  return res.status(204).end();
}

module.exports = { login, me, logout };
