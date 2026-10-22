// Testes da versão na URL dos CSS/JS (lib/assets.js). Rodar: npm test (node --test)
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { assetUrl, rewriteHtml, isCurrentVersion, htmlPage, resetCache } = require("../lib/assets");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "assets-"));
fs.mkdirSync(path.join(root, "css"));
fs.mkdirSync(path.join(root, "admin", "js"), { recursive: true });
fs.writeFileSync(path.join(root, "css", "site.css"), "body{}");
fs.writeFileSync(path.join(root, "admin", "js", "common.js"), "1");
fs.mkdirSync(path.join(root, "fonts"));
fs.writeFileSync(path.join(root, "fonts", "f.woff2"), "x");

test("assetUrl acrescenta ?v= com o hash do conteúdo e acompanha mudanças", () => {
  const first = assetUrl("/css/site.css", root);
  assert.match(first, /^\/css\/site\.css\?v=[0-9a-f]{8}$/);
  assert.equal(assetUrl("/css/site.css", root), first);
  fs.writeFileSync(path.join(root, "css", "site.css"), "body{color:red}");
  const future = new Date(Date.now() + 5000);
  fs.utimesSync(path.join(root, "css", "site.css"), future, future);
  assert.equal(assetUrl("/css/site.css", root), first); // conferido há menos de 1 s: usa a memória
  resetCache();
  assert.notEqual(assetUrl("/css/site.css", root), first);
});

test("assetUrl não mexe em fontes, arquivos inexistentes nem caminhos para fora da pasta", () => {
  assert.equal(assetUrl("/fonts/f.woff2", root), "/fonts/f.woff2");
  assert.equal(assetUrl("/css/nao-existe.css", root), "/css/nao-existe.css");
  assert.equal(assetUrl("/../segredo.js", root), "/../segredo.js");
});

test("rewriteHtml resolve endereços relativos à página e ignora externos", () => {
  const v = assetUrl("/admin/js/common.js", root).split("?v=")[1];
  const out = rewriteHtml([
    '<script src="js/common.js" defer></script>',
    '<link rel="stylesheet" href="../css/site.css">',
    '<link rel="preload" href="/fonts/f.woff2" as="font">',
    '<script src="https://exemplo.com/x.js"></script>',
    '<script src="js/common.js?x=1"></script>',
  ].join("\n"), "/admin/index.html", root);
  assert.match(out, new RegExp(`src="js/common\\.js\\?v=${v}" defer`));
  assert.match(out, /href="\.\.\/css\/site\.css\?v=[0-9a-f]{8}"/);
  assert.match(out, /href="\/fonts\/f\.woff2" as="font"/);
  assert.match(out, /src="https:\/\/exemplo\.com\/x\.js"/);
  assert.match(out, /src="js\/common\.js\?x=1"/);
});

test("isCurrentVersion só aceita o hash atual", () => {
  const v = assetUrl("/admin/js/common.js", root).split("?v=")[1];
  assert.equal(isCurrentVersion("/admin/js/common.js", v, root), true);
  assert.equal(isCurrentVersion("/admin/js/common.js", "00000000", root), false);
  assert.equal(isCurrentVersion("/admin/js/common.js", undefined, root), false);
  assert.equal(isCurrentVersion("/fonts/f.woff2", "x", root), false);
});

test("htmlPage aponta para a versão nova de um CSS mesmo sem o HTML mudar", () => {
  fs.writeFileSync(path.join(root, "pagina.html"), '<link rel="stylesheet" href="css/site.css">');
  const before = htmlPage("/pagina.html", root);
  fs.writeFileSync(path.join(root, "css", "site.css"), "body{color:blue}");
  const future = new Date(Date.now() + 10000);
  fs.utimesSync(path.join(root, "css", "site.css"), future, future);
  resetCache();
  const after = htmlPage("/pagina.html", root);
  assert.notEqual(after, before);
  assert.equal(after, `<link rel="stylesheet" href="${assetUrl("/css/site.css", root).slice(1)}">`);
  assert.equal(htmlPage("/nao-existe.html", root), null);
});
