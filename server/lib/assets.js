// Versão na URL dos arquivos CSS/JS do site e do painel (/css/site.css?v=ab12cd34).
// O "v" é um pedaço do hash do conteúdo: se o arquivo muda, a URL muda. Por isso o navegador pode
// guardar o arquivo por 1 ano sem perguntar ao servidor se ele mudou (ver app.js); quando muda,
// as páginas já apontam para a URL nova e o navegador baixa a versão nova.
//
// O hash fica em memória. Em produção os arquivos vêm dentro da imagem Docker e não mudam: cada
// arquivo é lido uma vez só. No desenvolvimento (arquivos editados com o servidor rodando), a data
// de modificação é conferida no máximo 1x por segundo e o hash é refeito quando ela muda. Conferir
// a cada pedido custava caro: numa pasta do Windows montada no Docker, cada consulta leva milissegundos.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const PUBLIC_DIR = path.resolve(process.env.PUBLIC_DIR || path.join(__dirname, "..", "public"));
// Só CSS e JS. Fontes ficam de fora: o preload no <head> precisa ter exatamente a mesma URL do
// @font-face do CSS, senão o navegador baixa a fonte duas vezes.
const VERSIONED = /\.(?:css|js)$/i;

const RECHECK_MS = process.env.NODE_ENV === "production" ? Infinity : 1000;
const cache = new Map(); // arquivo|tipo -> { mtimeMs, size, checkedAt, value } (value null = não existe)

// Valor derivado do conteúdo de um arquivo da pasta pública (hash, página reescrita...), guardado
// em memória. compute(file) só roda de novo quando o arquivo muda. null = arquivo não existe.
function cached(kind, urlPath, root, compute) {
  const file = path.join(root, urlPath);
  if (!file.startsWith(root + path.sep)) return null; // "../" para fora da pasta pública
  const id = `${kind}|${file}`;
  const known = cache.get(id);
  const now = Date.now();
  if (known && now - known.checkedAt < RECHECK_MS) return known.value;
  let stat = null;
  try { stat = fs.statSync(file); } catch { /* não existe */ }
  if (!stat || !stat.isFile()) {
    cache.set(id, { mtimeMs: 0, size: -1, checkedAt: now, value: null });
    return null;
  }
  if (known && known.value !== null && known.mtimeMs === stat.mtimeMs && known.size === stat.size) {
    known.checkedAt = now;
    return known.value;
  }
  const value = compute(file);
  cache.set(id, { mtimeMs: stat.mtimeMs, size: stat.size, checkedAt: now, value });
  return value;
}

// Hash do arquivo (ou null se ele não existe). urlPath: caminho absoluto no site ("/css/site.css").
const fileHash = (urlPath, root = PUBLIC_DIR) => cached("hash", urlPath, root,
  (file) => crypto.createHash("sha1").update(fs.readFileSync(file)).digest("hex").slice(0, 8));

// "/css/site.css" -> "/css/site.css?v=ab12cd34". Arquivo inexistente ou de outro tipo: sem mudança.
function assetUrl(urlPath, root = PUBLIC_DIR) {
  if (!VERSIONED.test(urlPath)) return urlPath;
  const hash = fileHash(urlPath, root);
  return hash ? `${urlPath}?v=${hash}` : urlPath;
}

// Acrescenta ?v= aos href/src de CSS e JS locais de uma página HTML. pagePath: caminho da página
// no site ("/admin/index.html"), para resolver endereços relativos ("../css/theme.css").
// Endereços externos, com query ou âncora ficam como estão.
const REF = /(\s(?:href|src)=")([^"?#:]+\.(?:css|js))"/gi;
function rewriteHtml(source, pagePath, root = PUBLIC_DIR) {
  return source.replace(REF, (whole, attr, ref) => {
    if (ref.startsWith("//")) return whole;
    const resolved = new URL(ref, `http://site${pagePath}`).pathname;
    const hash = fileHash(decodeURIComponent(resolved), root);
    return hash ? `${attr}${ref}?v=${hash}"` : whole;
  });
}

// O ?v= do pedido é o hash atual do arquivo? (só aí a resposta pode ir com cache de 1 ano;
// um ?v= antigo ou inventado recebe o arquivo atual sem esse cache.)
function isCurrentVersion(urlPath, v, root = PUBLIC_DIR) {
  return typeof v === "string" && VERSIONED.test(urlPath) && v === fileHash(urlPath, root);
}

// Página HTML da pasta pública com as versões nos links (ou null se não existe). Guarda o HTML
// original e reescreve a cada pedido (os hashes já estão em memória): se só um CSS mudar, a página
// passa a apontar para a versão nova dele.
function htmlPage(urlPath, root = PUBLIC_DIR) {
  const source = cached("html", urlPath, root, (file) => fs.readFileSync(file, "utf8"));
  return source === null ? null : rewriteHtml(source, urlPath, root);
}

// Só para os testes: esquece o que está em memória (para ver uma mudança logo em seguida).
const resetCache = () => cache.clear();

module.exports = { PUBLIC_DIR, assetUrl, rewriteHtml, isCurrentVersion, htmlPage, resetCache };
