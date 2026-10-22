const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const box = require("../lib/crypto-box");
const kiwify = require("../lib/kiwify");

/* ---------- Criptografia das chaves (lib/crypto-box.js) ---------- */
const KEY = crypto.randomBytes(32);

test("crypto-box: abre o que fechou e cada cifra é diferente", () => {
  const a = box.encrypt("segredo-123", "empresa-1", KEY);
  const b = box.encrypt("segredo-123", "empresa-1", KEY);
  assert.notEqual(a, b); // IV aleatório
  assert.ok(!a.includes("segredo"));
  assert.equal(box.decrypt(a, "empresa-1", KEY), "segredo-123");
});

test("crypto-box: recusa cifra alterada, chave errada e segredo de outra empresa", () => {
  const sealed = box.encrypt("segredo-123", "empresa-1", KEY);
  const parts = sealed.split(".");
  const flipped = Buffer.from(parts[3], "base64url");
  flipped[0] ^= 1;
  parts[3] = flipped.toString("base64url");
  assert.throws(() => box.decrypt(parts.join("."), "empresa-1", KEY));
  assert.throws(() => box.decrypt(sealed, "empresa-1", crypto.randomBytes(32)));
  assert.throws(() => box.decrypt(sealed, "empresa-2", KEY));
  assert.throws(() => box.decrypt("lixo", "empresa-1", KEY));
});

test("crypto-box: sem KIWIFY_ENCRYPTION_KEY válida, avisa em vez de usar chave fraca", () => {
  const saved = process.env.KIWIFY_ENCRYPTION_KEY;
  try {
    delete process.env.KIWIFY_ENCRYPTION_KEY;
    assert.equal(box.isConfigured(), false);
    assert.throws(() => box.encrypt("x", "y"), { code: "NO_MASTER_KEY" });
    process.env.KIWIFY_ENCRYPTION_KEY = Buffer.from("curta").toString("base64");
    assert.equal(box.isConfigured(), false);
    process.env.KIWIFY_ENCRYPTION_KEY = KEY.toString("base64");
    assert.equal(box.isConfigured(), true);
  } finally {
    if (saved === undefined) delete process.env.KIWIFY_ENCRYPTION_KEY; else process.env.KIWIFY_ENCRYPTION_KEY = saved;
  }
});

/* ---------- Cliente da API (lib/kiwify.js), com a Kiwify simulada ---------- */
const account = { key: "empresa-1", account_id: "conta1", client_id: "cliente1", client_secret: "segredo-123" };
const PRODUCT = {
  id: "20072760-3699-11ee-b627-87e13b212de8", name: "Manual", price: 19700, status: "active",
  links: [
    { id: "KMgND1r", custom_name: null, status: "active", is_sales_page: false },
    { id: "Promo01", custom_name: "Promoção", status: "active", price: 9700 },
    { id: "Velho01", custom_name: "Antigo", status: "disabled" },
  ],
};

// Simula a Kiwify: registra as chamadas e responde conforme a função "reply".
function fakeKiwify(reply) {
  const calls = [];
  kiwify._setFetch(async (url, init) => {
    calls.push({ url, init });
    const { status = 200, body } = reply(url, init, calls.length);
    return { status, json: async () => body };
  });
  return calls;
}
const tokenReply = (n = 1) => ({ body: { access_token: `tok${n}`, token_type: "Bearer", expires_in: 86400 } });

test("kiwify: pede o token uma vez, reaproveita e manda os cabeçalhos certos", async () => {
  let tokens = 0;
  const calls = fakeKiwify((url) => (url.endsWith("/oauth/token") ? tokenReply(++tokens) : { body: PRODUCT }));
  await kiwify.getProduct(account, PRODUCT.id);
  await kiwify.getProduct(account, PRODUCT.id);
  assert.equal(tokens, 1);
  const [tokenCall, get] = calls;
  assert.equal(tokenCall.url, "https://public-api.kiwify.com/v1/oauth/token");
  assert.equal(tokenCall.init.method, "POST");
  assert.match(tokenCall.init.body, /client_id=cliente1&client_secret=segredo-123/);
  assert.equal(get.url, `https://public-api.kiwify.com/v1/products/${PRODUCT.id}`);
  assert.equal(get.init.headers.Authorization, "Bearer tok1");
  assert.equal(get.init.headers["x-kiwify-account-id"], "conta1");
  assert.equal(get.init.redirect, "error");
});

test("kiwify: token recusado (401) -> pede outro e tenta de novo uma vez", async () => {
  let tokens = 0, gets = 0;
  fakeKiwify((url) => {
    if (url.endsWith("/oauth/token")) return tokenReply(++tokens);
    gets += 1;
    return gets === 1 ? { status: 401, body: {} } : { body: PRODUCT };
  });
  const product = await kiwify.getProduct(account, PRODUCT.id);
  assert.equal(product.name, "Manual");
  assert.equal(tokens, 2);
});

test("kiwify: chaves erradas e Kiwify fora do ar viram mensagens claras", async () => {
  fakeKiwify(() => ({ status: 400, body: { error: "auth_error", message: "invalid client" } }));
  await assert.rejects(kiwify.getProduct(account, PRODUCT.id), (e) => e instanceof kiwify.KiwifyError && e.status === 400
    && /recusou as chaves/.test(e.message) && !e.message.includes("segredo-123"));

  kiwify._setFetch(async () => { throw new Error("ECONNREFUSED segredo-123"); });
  await assert.rejects(kiwify.getProduct(account, PRODUCT.id), (e) => e.status === 502 && !e.message.includes("segredo"));
});

test("kiwify: ID inválido é recusado sem chamar a rede", async () => {
  const calls = fakeKiwify(() => tokenReply());
  for (const bad of ["../oauth/token", "a/b", "x".repeat(65), "", null, "https://evil.example"]) {
    await assert.rejects(kiwify.getProduct(account, bad), { status: 400 });
  }
  assert.equal(calls.length, 0);
});

test("kiwify: toCheckout usa o preço do link (ou do produto) e o link pay.kiwify", () => {
  assert.deepEqual(kiwify.toCheckout(PRODUCT, "KMgND1r"), { price_cents: 19700, checkout_url: "https://pay.kiwify.com.br/KMgND1r" });
  assert.deepEqual(kiwify.toCheckout(PRODUCT, "Promo01"), { price_cents: 9700, checkout_url: "https://pay.kiwify.com.br/Promo01" });
  assert.throws(() => kiwify.toCheckout(PRODUCT, "Velho01"), /desativado/);
  assert.throws(() => kiwify.toCheckout(PRODUCT, "Sumiu01"), /não existe mais/);
  assert.equal(kiwify.toCents(null), null);
  assert.equal(kiwify.toCents(-1), null);
  assert.equal(kiwify.toCents("500"), 500);
});

test("kiwify: lista todas as páginas de produtos, em ordem alfabética, sem os links", async () => {
  const page = (n, count) => Array.from({ length: count }, (_, i) => ({ id: `p${n}-${i}`, name: `Produto ${n}-${String(i).padStart(3, "0")}`, price: 100 }));
  fakeKiwify((url) => {
    if (url.endsWith("/oauth/token")) return tokenReply();
    const n = Number(new URL(url).searchParams.get("page_number"));
    return { body: { pagination: { count: 130, page_number: n, page_size: 100 }, data: n === 1 ? page(1, 100) : page(2, 30) } };
  });
  const list = await kiwify.listProducts(account);
  assert.equal(list.length, 130);
  assert.equal(list[0].name, "Produto 1-000");
  assert.equal(list[0].links, undefined);
  assert.equal(list[0].price_cents, 100);
});
