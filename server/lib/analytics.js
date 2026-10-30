// Contagem de visitas e cliques do site (aba Resumo do painel), sem cookies e sem guardar IP.
// O navegador manda o evento (public/js/track.js); aqui ele é conferido, reduzido ao mínimo e gravado.
const crypto = require("node:crypto");
const pool = require("../config/database");

const TIME_ZONE = "America/Sao_Paulo";
const TYPES = new Set(["view", "checkout_click"]);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PATH = /^\/[a-z0-9._/-]{0,199}$/i;
const HOST = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;
const KEEP_MONTHS = 13;

// Robôs e prévias de link (WhatsApp, Facebook...) não contam como visita.
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|preview|headless|lighthouse|python|curl|wget|node-fetch|axios|go-http/i;
const isBot = (ua) => !ua || BOT.test(ua);

function deviceOf(ua = "") {
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) return "tablet";
  if (/Mobi|iPhone|iPod|Android/i.test(ua)) return "mobile";
  return "desktop";
}

// Texto curto e limpo (UTM): sem caracteres de controle, minúsculo, até 100 caracteres.
function cleanTag(value) {
  if (typeof value !== "string") return null;
  const v = value.replace(/[\u0000-\u001f\u007f]/g, "").trim().toLowerCase().slice(0, 100);
  return v || null;
}

// Só o domínio de origem, sem "www." e sem os subdomínios de redirecionamento das redes
// (l.instagram.com, lm.facebook.com...). Links do próprio site não são origem.
function refHost(value, ownHost) {
  if (typeof value !== "string") return null;
  let host = value.trim().toLowerCase();
  if (!HOST.test(host) || host.length > 100) return null;
  host = host.replace(/^(?:www|m|l|lm|mobile)\./, "");
  const own = String(ownHost || "").toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "");
  if (own && host === own) return null;
  return host;
}

// Endereço do produto: /p/<endereço> vem do próprio caminho; nas outras páginas, do campo "product".
function productSlug(path, product) {
  const m = /^\/p\/([^/]+)$/.exec(path);
  const slug = m ? m[1] : product;
  return typeof slug === "string" && SLUG.test(slug) && slug.length <= 200 ? slug : null;
}

// "Sal" do dia, só em memória: o mesmo visitante tem o mesmo resumo durante o dia e outro no dia
// seguinte. Reiniciar o servidor troca o sal (no máximo, conta alguém duas vezes naquele dia).
let salt = { day: null, value: null };
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
function visitorHash(ip, ua) {
  const day = today();
  if (salt.day !== day) salt = { day, value: crypto.randomBytes(32) };
  return crypto.createHmac("sha256", salt.value).update(`${ip}|${ua}`).digest("hex").slice(0, 16);
}

// Confere o corpo enviado pelo navegador. Devolve o evento pronto para gravar, ou null (ignorado).
function parseEvent(body, { ua, ownHost }) {
  if (!body || typeof body !== "object" || !TYPES.has(body.type)) return null;
  const path = typeof body.path === "string" ? body.path : "";
  if (!PATH.test(path) || path.includes("..")) return null;
  const utm = body.utm && typeof body.utm === "object" ? body.utm : {};
  return {
    type: body.type,
    path,
    slug: productSlug(path, body.product),
    ref_host: refHost(body.ref, ownHost),
    utm_source: cleanTag(utm.source),
    utm_medium: cleanTag(utm.medium),
    utm_campaign: cleanTag(utm.campaign),
    device: deviceOf(ua),
  };
}

async function recordEvent(event, { ip, ua }) {
  await pool.query(
    `INSERT INTO site_events (type, path, product_id, ref_host, utm_source, utm_medium, utm_campaign, device, visitor_hash)
     VALUES ($1, $2, (SELECT id FROM products WHERE slug = $3), $4, $5, $6, $7, $8, $9)`,
    [event.type, event.path, event.slug, event.ref_host, event.utm_source, event.utm_medium,
      event.utm_campaign, event.device, visitorHash(ip, ua)]);
}

// Apaga eventos antigos (mais de 13 meses): o Resumo mostra no máximo 90 dias.
async function purgeOld() {
  const { rowCount } = await pool.query(
    `DELETE FROM site_events WHERE occurred_at < now() - make_interval(months => ${KEEP_MONTHS})`);
  if (rowCount) console.log(`Resumo: ${rowCount} evento(s) antigo(s) apagado(s).`);
}

module.exports = { TIME_ZONE, isBot, deviceOf, cleanTag, refHost, productSlug, parseEvent, recordEvent, purgeOld, visitorHash };
