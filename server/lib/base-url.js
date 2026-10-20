// Endereço público do site, usado em links absolutos (canonical, og:url, og:image).
// Em produção, defina PUBLIC_URL (ex.: https://www.seusite.com.br). Sem ela, usa o endereço da
// requisição — que vem do cabeçalho Host, escolhido pelo cliente: atrás de um cache (CDN/proxy),
// um Host falso poderia ficar gravado na página servida a todos. Por isso o aviso no início.

// PUBLIC_URL normalizada (sem barra no fim), "" se vazia; lança erro se não for http(s) válido.
function configuredBaseUrl() {
  const raw = (process.env.PUBLIC_URL || "").trim();
  if (!raw) return "";
  let url;
  try { url = new URL(raw); } catch { url = null; }
  if (!url || !["http:", "https:"].includes(url.protocol) || url.search || url.hash) {
    throw new Error(`PUBLIC_URL inválida: "${raw}" (use algo como https://www.seusite.com.br).`);
  }
  return url.href.replace(/\/+$/, "");
}

const HOST = /^[a-z0-9.-]+(:\d{1,5})?$|^\[[0-9a-f:.]+\](:\d{1,5})?$/i; // nome, IPv4 ou [IPv6], com porta opcional

function baseUrl(req) {
  const configured = configuredBaseUrl();
  if (configured) return configured;
  const host = req.get("host") || "";
  return `${req.protocol}://${HOST.test(host) ? host : "localhost"}`;
}

module.exports = { baseUrl, configuredBaseUrl };
