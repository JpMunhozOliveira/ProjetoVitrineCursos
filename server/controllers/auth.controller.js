const pool = require("../config/database");
const sec = require("../lib/security");
const { COOKIE } = require("../middleware/admin-auth");

const SESSION_HOURS = Math.max(1, Math.round(Number(process.env.SESSION_HOURS) || 12));
const WINDOW = 15 * 60 * 1000;
const byIpEmail = sec.createLimiter({ max: 5, windowMs: WINDOW });
const byIp = sec.createLimiter({ max: 30, windowMs: WINDOW });

function sessionCookie(value, maxAgeSeconds) {
  const parts = [`${COOKIE}=${value}`, "Path=/", "HttpOnly", "SameSite=Strict", `Max-Age=${maxAgeSeconds}`];
  if (process.env.COOKIE_SECURE === "true") parts.push("Secure"); // ative quando o site estiver em HTTPS
  return parts.join("; ");
}

async function login(req, res) {
  const { email, password } = req.body || {};
  if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password || password.length > 256) {
    return res.status(400).json({ error: "Informe e-mail e senha." });
  }
  const mail = email.trim().toLowerCase();
  const keyPair = `${req.ip}|${mail}`;

  if (byIpEmail.isBlocked(keyPair) || byIp.isBlocked(req.ip)) {
    res.set("Retry-After", String(WINDOW / 1000));
    return res.status(429).json({ error: "Muitas tentativas. Aguarde alguns minutos e tente de novo." });
  }

  const { rows } = await pool.query(
    "SELECT id, email, password_hash FROM admin_users WHERE lower(email) = $1", [mail]);
  const ok = await sec.verifyPassword(password, rows[0]?.password_hash);
  if (!ok) {
    byIpEmail.fail(keyPair); byIp.fail(req.ip);
    return res.status(401).json({ error: "E-mail ou senha incorretos." });
  }
  byIpEmail.clear(keyPair);

  const token = sec.randomToken();
  const csrf = sec.randomToken();
  await pool.query("DELETE FROM admin_sessions WHERE expires_at < now()");
  await pool.query(
    `INSERT INTO admin_sessions (user_id, token_hash, csrf_token, expires_at)
     VALUES ($1, $2, $3, now() + make_interval(hours => $4))`,
    [rows[0].id, sec.sha256(token), csrf, SESSION_HOURS]);
  await pool.query("UPDATE admin_users SET last_login_at = now() WHERE id = $1", [rows[0].id]);

  res.set("Set-Cookie", sessionCookie(token, SESSION_HOURS * 3600));
  return res.json({ data: { email: rows[0].email, csrfToken: csrf } });
}

function me(req, res) {
  const { via, email = null, csrfToken = null } = req.admin;
  return res.json({ data: { via, email, csrfToken } });
}

async function logout(req, res) {
  if (req.admin.sessionId) await pool.query("DELETE FROM admin_sessions WHERE id = $1", [req.admin.sessionId]);
  res.set("Set-Cookie", sessionCookie("", 0));
  return res.status(204).end();
}

module.exports = { login, me, logout };
