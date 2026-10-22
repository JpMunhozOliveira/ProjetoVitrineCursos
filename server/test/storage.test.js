// Testes dos nomes de arquivo das imagens e das versões menores (lib/storage.js). Rodar: npm test
const { test } = require("node:test");
const assert = require("node:assert/strict");
const storage = require("../lib/storage");

const KEY = "ab/ab0123456789abcdef0123456789abcd.webp";

test("versão menor fica ao lado da original, com a largura no nome", () => {
  assert.equal(storage.variantKey(KEY, 480), "ab/ab0123456789abcdef0123456789abcd-480.webp");
  assert.equal(storage.variantUrl(KEY, 960), "/uploads/ab/ab0123456789abcdef0123456789abcd-960.webp");
  assert.throws(() => storage.variantKey("../x.webp", 480));
  assert.throws(() => storage.variantKey(storage.variantKey(KEY, 480), 960)); // versão de versão
  assert.throws(() => storage.variantKey(KEY, "480"));
});

test("srcset lista as versões e a original; sem versões, null", () => {
  assert.equal(storage.srcset(KEY, 1024, [480, 960]),
    "/uploads/ab/ab0123456789abcdef0123456789abcd-480.webp 480w, /uploads/ab/ab0123456789abcdef0123456789abcd-960.webp 960w, /uploads/ab/ab0123456789abcdef0123456789abcd.webp 1024w");
  assert.equal(storage.srcset(KEY, 300, []), null);
  assert.equal(storage.srcset(KEY, 300, null), null);
});
