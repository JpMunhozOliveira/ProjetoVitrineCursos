#!/usr/bin/env node
// Teste de carga simples, sem dependências (Node 22+).
// Simula vários visitantes ao mesmo tempo pedindo as páginas principais e mostra, por endereço:
// pedidos por segundo, tempo médio, p95/p99 (95%/99% dos pedidos foram mais rápidos que isso) e erros.
//
//   node scripts/teste-carga.js                                  -> http://127.0.0.1:3000, 20 conexões, 10 s
//   node scripts/teste-carga.js https://seusite.com.br 50 20     -> endereço, conexões, segundos
//
// Use 127.0.0.1 em vez de localhost: no Windows, "localhost" tenta IPv6 primeiro e cada conexão
// demora ~200 ms a mais. Não rode contra o servidor público em horário de vendas.

const base = (process.argv[2] || "http://127.0.0.1:3000").replace(/\/$/, "");
const connections = Number(process.argv[3] || 20);
const seconds = Number(process.argv[4] || 10);

if (!Number.isInteger(connections) || connections < 1 || !(seconds > 0)) {
  console.error("Uso: node scripts/teste-carga.js [endereço] [conexões] [segundos]");
  process.exit(1);
}

const percentile = (sorted, p) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)] : 0;
const ms = (n) => `${n.toFixed(1)} ms`.padStart(10);

async function run(path) {
  const times = [];
  let errors = 0;
  const end = performance.now() + seconds * 1000;
  async function worker() {
    while (performance.now() < end) {
      const start = performance.now();
      try {
        const res = await fetch(base + path);
        await res.arrayBuffer(); // baixa o corpo inteiro, como o navegador
        if (res.ok) times.push(performance.now() - start); else errors++;
      } catch {
        errors++;
      }
    }
  }
  await Promise.all(Array.from({ length: connections }, worker));
  times.sort((a, b) => a - b);
  const avg = times.reduce((s, t) => s + t, 0) / (times.length || 1);
  console.log(`${path.padEnd(40)} ${String(Math.round(times.length / seconds)).padStart(6)} req/s ${ms(avg)} ${ms(percentile(times, 0.95))} ${ms(percentile(times, 0.99))} ${String(errors).padStart(6)}`);
}

(async () => {
  // Página de vendas: a primeira do catálogo com página publicada.
  let salesPath = null;
  try {
    const { data } = await (await fetch(`${base}/api/products`)).json();
    const withPage = data.find((p) => p.has_sales_page);
    if (withPage) salesPath = `/p/${withPage.slug}`;
  } catch (error) {
    console.error(`Não consegui abrir ${base}/api/products: ${error.message}`);
    process.exit(1);
  }

  console.log(`${base} — ${connections} conexões simultâneas, ${seconds} s por endereço\n`);
  console.log(`${"endereço".padEnd(40)} ${"pedidos".padStart(12)} ${"média".padStart(10)} ${"p95".padStart(10)} ${"p99".padStart(10)} ${"erros".padStart(6)}`);
  for (const path of ["/", "/catalogo.html", "/css/site.css", "/api/products", salesPath].filter(Boolean)) {
    await run(path);
  }
})();
