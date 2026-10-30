const test = require("node:test");
const assert = require("node:assert/strict");
const a = require("../lib/analytics");

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0";
const ANDROID_TABLET = "Mozilla/5.0 (Linux; Android 14; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

test("analytics: robôs e prévias de link não contam", () => {
  for (const ua of ["", "Googlebot/2.1", "facebookexternalhit/1.1", "WhatsApp/2.23.20.0", "curl/8.0", "python-requests/2.31"]) {
    assert.equal(a.isBot(ua), true, ua);
  }
  assert.equal(a.isBot(CHROME), false);
  assert.equal(a.isBot(IPHONE), false); // navegador do Instagram é gente
});

test("analytics: tipo de aparelho pelo navegador", () => {
  assert.equal(a.deviceOf(CHROME), "desktop");
  assert.equal(a.deviceOf(IPHONE), "mobile");
  assert.equal(a.deviceOf(ANDROID_TABLET), "tablet");
});

test("analytics: origem fica só com o domínio e ignora o próprio site", () => {
  assert.equal(a.refHost("l.instagram.com"), "instagram.com");
  assert.equal(a.refHost("www.google.com.br"), "google.com.br");
  assert.equal(a.refHost("lm.facebook.com"), "facebook.com");
  assert.equal(a.refHost("www.meusite.com.br", "meusite.com.br"), null);
  assert.equal(a.refHost("meusite.com.br", "www.meusite.com.br:443"), null);
  for (const bad of ["https://x.com/a", "x", "a b.com", "<script>.com", 42, null]) assert.equal(a.refHost(bad), null);
});

test("analytics: parseEvent valida tudo e limpa as UTMs", () => {
  const ev = a.parseEvent({ type: "view", path: "/p/manual-reforma", ref: "l.instagram.com",
    utm: { source: " Instagram\u0000 ", medium: "x".repeat(300), campaign: 7 } }, { ua: IPHONE, ownHost: "meusite.com.br" });
  assert.deepEqual(ev, { type: "view", path: "/p/manual-reforma", slug: "manual-reforma", ref_host: "instagram.com",
    utm_source: "instagram", utm_medium: "x".repeat(100), utm_campaign: null, device: "mobile" });
  assert.equal(a.parseEvent({ type: "checkout_click", path: "/produto.html", product: "curso-x" }, { ua: CHROME }).slug, "curso-x");
  assert.equal(a.parseEvent({ type: "view", path: "/produto.html", product: "../../x" }, { ua: CHROME }).slug, null);
  for (const bad of [null, "x", { type: "delete", path: "/" }, { type: "view", path: "http://x" },
    { type: "view", path: "/a/../b" }, { type: "view", path: "/" + "a".repeat(300) }, { type: "view", path: "/<x>" }]) {
    assert.equal(a.parseEvent(bad, { ua: CHROME }), null);
  }
});

test("analytics: mesmo visitante tem o mesmo resumo no dia, sem o IP aparecer", () => {
  const h1 = a.visitorHash("200.1.2.3", CHROME), h2 = a.visitorHash("200.1.2.3", CHROME);
  assert.equal(h1, h2);
  assert.match(h1, /^[0-9a-f]{16}$/);
  assert.notEqual(a.visitorHash("200.1.2.4", CHROME), h1);
});
